import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://nsbuezwakcyxgvrwiela.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zYnVlendha2N5eGd2cndpZWxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1NTcwMjUsImV4cCI6MjA3MDEzMzAyNX0.L33UWCIRi5CS1cenMfw6EYOzrGg2k_OK8wVukEE4WLI'; // Replace with your anon key
const supabase = createClient(supabaseUrl, supabaseKey);

// Elements
const loginView = document.getElementById('loginView');
const dashboardView = document.getElementById('dashboardView');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginError = document.getElementById('loginError');

const userList = document.getElementById('userList');

const tabOverview = document.getElementById('tabOverview');
const tabChat = document.getElementById('tabChat');

const overviewSection = document.getElementById('overviewSection');
const chatSection = document.getElementById('chatSection');

const chatUsername = document.getElementById('chatUsername');
const chatUserImage = document.getElementById('chatUserImage');
const chatWindow = document.getElementById('chatWindow');
const msgInput = document.getElementById('msgInput');
const sendBtn = document.getElementById('sendBtn');

const totalMessagesEl = document.getElementById('totalMessages');
const activeUsersEl = document.getElementById('activeUsers');
const avgResponseTimeEl = document.getElementById('avgResponseTime');
const openConversationsEl = document.getElementById('openConversations');
const recentConversationsBody = document.getElementById('recentConversationsBody');

let messagesChart, usersChart;
let currentUserId = null;
let chatSubscription = null;

const ALLOWED_ADMIN_EMAIL = 'kelvin.net6@gmail.com'; // Your allowed admin email whitelist

// ===== AUTH =====
async function checkAuth() {
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    const user = data.session.user;
    if (user.email === ALLOWED_ADMIN_EMAIL) {
      showDashboard();
    } else {
      alert('Access denied: not an authorized admin.');
      await supabase.auth.signOut();
      showLogin();
    }
  } else {
    showLogin();
  }
}

loginBtn.addEventListener('click', async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  if (!email || !password) {
    loginError.textContent = 'Email and password are required';
    loginError.classList.remove('hidden');
    return;
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    loginError.textContent = 'Invalid credentials';
    loginError.classList.remove('hidden');
  } else {
    loginError.classList.add('hidden');
    checkAuth();
  }
});

logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
  showLogin();
});

// ===== UI toggles =====
function showLogin() {
  loginView.classList.remove('hidden');
  dashboardView.classList.add('hidden');
}

function showDashboard() {
  loginView.classList.add('hidden');
  dashboardView.classList.remove('hidden');
  loadUsers();
  loadDashboard();
  switchToOverview();
}

// ===== USER LIST & AVATARS =====
async function loadUsers() {
  // Get distinct user_ids from messages where sender != 'admin'
  const { data: messages, error } = await supabase
    .from('support_messages')
    .select('user_id')
    .neq('sender', 'admin');

  if (error) {
    console.error('Error loading users:', error);
    return;
  }

  const uniqueUserIds = [...new Set(messages.map(m => m.user_id))];

  userList.innerHTML = '';
  for (const userId of uniqueUserIds) {
    // Try get avatar public URL from storage bucket 'avatars'
    const { data: avatarData } = supabase.storage.from('avatars').getPublicUrl(`${userId}.jpg`);
    const avatarUrl = avatarData?.publicUrl || 'https://via.placeholder.com/40';

    const div = document.createElement('div');
    div.className = 'flex items-center space-x-3 p-2 hover:bg-gray-100 cursor-pointer rounded';
    div.innerHTML = `
      <img src="${avatarUrl}" class="w-8 h-8 rounded-full" />
      <span class="text-sm font-medium">${userId.slice(0, 10)}...</span>
    `;
    div.onclick = () => {
      switchToChat();
      loadChat(userId, avatarUrl);
    };
    userList.appendChild(div);
  }
}

// ===== CHAT =====
async function loadChat(userId, avatarUrl) {
  currentUserId = userId;
  chatUsername.textContent = `Chat with ${userId.slice(0, 10)}...`;
  chatUserImage.src = avatarUrl;
  chatUserImage.classList.remove('hidden');
  await displayMessages();

  if (chatSubscription) {
    supabase.removeChannel(chatSubscription);
  }

  chatSubscription = supabase.channel(`chat:${userId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'support_messages',
      filter: `user_id=eq.${userId}`
    }, () => {
      displayMessages();
    })
    .subscribe();
}

async function displayMessages() {
  if (!currentUserId) return;

  const { data, error } = await supabase
    .from('support_messages')
    .select('*')
    .eq('user_id', currentUserId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching messages:', error);
    return;
  }

  chatWindow.innerHTML = '';
  if (data.length === 0) {
    chatWindow.innerHTML = '<p class="text-gray-400 text-center">No messages yet.</p>';
    return;
  }

  data.forEach(msg => {
    const div = document.createElement('div');
    div.className = `my-2 p-3 rounded max-w-[70%] ${
      msg.sender === 'admin' ? 'bg-blue-100 self-end ml-auto' : 'bg-gray-200'
    }`;
    div.innerHTML = `
      <div class="text-sm">${msg.message}</div>
      <div class="text-[10px] text-right mt-1 text-gray-500">${new Date(msg.created_at).toLocaleTimeString()}</div>
    `;
    chatWindow.appendChild(div);
  });
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

sendBtn.addEventListener('click', async () => {
  const message = msgInput.value.trim();
  if (!message || !currentUserId) return;

  const { error } = await supabase.from('support_messages').insert([
    {
      user_id: currentUserId,
      message,
      sender: 'admin',
      created_at: new Date().toISOString()
    }
  ]);

  if (error) {
    alert('Failed to send message: ' + error.message);
  } else {
    msgInput.value = '';
    // displayMessages() will be called via subscription
  }
});

// ===== DASHBOARD (OVERVIEW) =====
async function loadDashboard() {
  const { data: messages, error } = await supabase.from('support_messages').select('*');

  if (error) {
    console.error('Failed to load dashboard data:', error);
    return;
  }

  // Total Messages
  totalMessagesEl.textContent = messages.length;

  // Active Users
  const userIds = [...new Set(messages.map(m => m.user_id))];
  activeUsersEl.textContent = userIds.length;

  // Open Conversations (last sender user)
  const lastMessages = {};
  messages.forEach(msg => {
    if (!lastMessages[msg.user_id] || new Date(msg.created_at) > new Date(lastMessages[msg.user_id].created_at)) {
      lastMessages[msg.user_id] = msg;
    }
  });

  const openConvosCount = Object.values(lastMessages).filter(m => m.sender === 'user').length;
  openConversationsEl.textContent = openConvosCount;

  // Avg Response Time
  let totalResponseTime = 0;
  let responseCount = 0;
  const messagesByUser = {};
  messages.forEach(msg => {
    if (!messagesByUser[msg.user_id]) messagesByUser[msg.user_id] = [];
    messagesByUser[msg.user_id].push(msg);
  });
  Object.values(messagesByUser).forEach(userMsgs => {
    userMsgs.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
    for (let i=0; i < userMsgs.length -1; i++) {
      if (userMsgs[i].sender === 'user' && userMsgs[i+1].sender === 'admin') {
        totalResponseTime += (new Date(userMsgs[i+1].created_at) - new Date(userMsgs[i].created_at));
        responseCount++;
      }
    }
  });

  if (responseCount > 0) {
    const avgMinutes = Math.round(totalResponseTime / responseCount / 60000);
    avgResponseTimeEl.textContent = avgMinutes + ' min';
  } else {
    avgResponseTimeEl.textContent = '--';
  }

  renderMessagesChart(messages);
  renderUsersChart(messagesByUser);

  // Recent Conversations Table
  const sortedMsgs = [...messages].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
  const recentUserIds = [...new Set(sortedMsgs.map(m => m.user_id))].slice(0,10);
  recentConversationsBody.innerHTML = '';
  recentUserIds.forEach(userId => {
    const lastMsg = sortedMsgs.find(m => m.user_id === userId);
    const status = lastMessages[userId].sender === 'user' ? 'Open' : 'Closed';

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50';
    tr.innerHTML = `
      <td class="border px-4 py-2 font-mono text-sm">${userId.slice(0,10)}...</td>
      <td class="border px-4 py-2">${lastMsg.message}</td>
      <td class="border px-4 py-2">${new Date(lastMsg.created_at).toLocaleString()}</td>
      <td class="border px-4 py-2 font-semibold ${status === 'Open' ? 'text-red-600' : 'text-green-600'}">${status}</td>
    `;
    recentConversationsBody.appendChild(tr);
  });
}

// ===== CHARTS =====
let messagesChart = null;
function renderMessagesChart(messages) {
  const dayLabels = [];
  const dayCounts = [];
  const now = new Date();
  for(let i=13; i>=0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    dayLabels.push(d.toLocaleDateString(undefined, {month:'short', day:'numeric'}));
    dayCounts.push(0);
  }
  messages.forEach(msg => {
    const msgDate = new Date(msg.created_at);
    const label = msgDate.toLocaleDateString(undefined, {month:'short', day:'numeric'});
    const idx = dayLabels.indexOf(label);
    if (idx >= 0) dayCounts[idx]++;
  });

  if(messagesChart) messagesChart.destroy();
  const ctx = document.getElementById('messagesChart').getContext('2d');
  messagesChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dayLabels,
      datasets: [{
        label: 'Messages',
        data: dayCounts,
        fill: true,
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 2,
        pointRadius: 3,
        tension: 0.3,
      }]
    },
    options: {
      responsive: true,
      plugins: {legend: {display:true}},
      scales: { y: {beginAtZero:true, precision:0} },
    }
  });
}

let usersChart = null;
function renderMessagesChart(messages) {
  const dayLabels = [];
  const dayCounts = [];

  // Prepare date range (last 14 days)
  const now = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    dayLabels.push(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
    dayCounts.push(0);
  }

  // Count messages per day
  messages.forEach((msg) => {
    const msgDate = new Date(msg.created_at);
    const label = msgDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const index = dayLabels.indexOf(label);
    if (index >= 0) dayCounts[index]++;
  });

  // Destroy previous chart if exists
  if (typeof messagesChart !== 'undefined' && messagesChart) {
    messagesChart.destroy();
  }

  const ctx = document.getElementById('messagesChart').getContext('2d');
  messagesChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dayLabels,
      datasets: [{
        label: 'Messages',
        data: dayCounts,
        fill: true,
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 2,
        pointRadius: 3,
        tension: 0.3,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true },
      },
      scales: {
        y: { beginAtZero: true, precision: 0 },
      },
    },
  });
}


// ===== NAV TABS =====
tabOverview.addEventListener('click', () => {
  switchToOverview();
});
tabChat.addEventListener('click', () => {
  switchToChat();
});

function switchToOverview() {
  overviewSection.classList.remove('hidden');
  chatSection.classList.add('hidden');
  tabOverview.classList.add('border-blue-600', 'font-semibold');
  tabOverview.classList.remove('text-gray-500');
  tabChat.classList.add('text-gray-500');
  tabChat.classList.remove('border-blue-600', 'font-semibold');
}

function switchToChat() {
  overviewSection.classList.add('hidden');
  chatSection.classList.remove('hidden');
  tabChat.classList.remove('text-gray-500');
  tabChat.classList.add('border-blue-600', 'font-semibold');
  tabOverview.classList.remove('border-blue-600', 'font-semibold');
  tabOverview.classList.add('text-gray-500');
  if (currentUserId) {
    loadChat(currentUserId);
  }
}

// ===== INITIALIZE =====
checkAuth();
