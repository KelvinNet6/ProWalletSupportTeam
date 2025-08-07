import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://nsbuezwakcyxgvrwiela.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zYnVlendha2N5eGd2cndpZWxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1NTcwMjUsImV4cCI6MjA3MDEzMzAyNX0.L33UWCIRi5CS1cenMfw6EYOzrGg2k_OK8wVukEE4WLI'; // Use real anon key (from Supabase project)
const supabase = createClient(supabaseUrl, supabaseKey);

// UI elements
const loginView = document.getElementById('loginView');
const dashboardView = document.getElementById('dashboardView');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginError = document.getElementById('loginError');
const userList = document.getElementById('userList');
const chatWindow = document.getElementById('chatWindow');
const msgInput = document.getElementById('msgInput');
const chatUsername = document.getElementById('chatUsername');
const chatUserImage = document.getElementById('chatUserImage');

let currentUserId = null;
const allowedAdminEmail = "admin@prowallet.com"; // Your whitelisted admin email

// Check auth on page load
checkAuth();

// LOGIN
loginBtn.addEventListener('click', async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    loginError.textContent = 'Invalid credentials';
    loginError.classList.remove('hidden');
    return;
  }

  if (data.session.user.email === allowedAdminEmail) {
    loginError.classList.add('hidden');
    showDashboard();
  } else {
    alert("Access denied: not an authorized admin.");
    await supabase.auth.signOut();
    showLogin();
  }
});

// LOGOUT
logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
  showLogin();
});

// Show Login
function showLogin() {
  loginView.classList.remove('hidden');
  dashboardView.classList.add('hidden');
}

// Show Dashboard
function showDashboard() {
  loginView.classList.add('hidden');
  dashboardView.classList.remove('hidden');
  loadUsers();
}

// Check current session
async function checkAuth() {
  const { data } = await supabase.auth.getSession();
  const session = data?.session;

  if (session?.user?.email === allowedAdminEmail) {
    showDashboard();
  } else {
    showLogin();
  }
}

// Load user list from support_messages
async function loadUsers() {
  const { data: users } = await supabase
    .from('support_messages')
    .select('user_id, sender')
    .neq('sender', 'admin');

  const uniqueUserIds = [...new Set(users.map(u => u.user_id))];

  userList.innerHTML = '';
  for (const userId of uniqueUserIds) {
    const { data: avatarData } = supabase.storage
      .from('avatars')
      .getPublicUrl(`${userId}.jpg`);
    const avatar = avatarData?.publicUrl || 'https://via.placeholder.com/40';

    const div = document.createElement('div');
    div.className = 'flex items-center space-x-3 p-2 hover:bg-gray-100 cursor-pointer rounded';
    div.innerHTML = `
      <img src="${avatar}" class="w-8 h-8 rounded-full" />
      <span class="text-sm font-medium">${userId.slice(0, 10)}...</span>
    `;
    div.onclick = () => loadChat(userId, avatar);
    userList.appendChild(div);
  }
}

// Load chat messages
async function loadChat(userId, avatar) {
  currentUserId = userId;
  chatUsername.textContent = `Chat with ${userId.slice(0, 10)}...`;
  chatUserImage.src = avatar;
  chatUserImage.classList.remove('hidden');

  await displayMessages();

  supabase.channel(`chat:${userId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'support_messages',
      filter: `user_id=eq.${userId}`
    }, payload => {
      displayMessages();
    })
    .subscribe();
}

// Display messages
async function displayMessages() {
  const { data } = await supabase
    .from('support_messages')
    .select('*')
    .eq('user_id', currentUserId)
    .order('created_at', { ascending: true });

  chatWindow.innerHTML = '';
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

// Send message
window.sendMessage = async () => {
  const message = msgInput.value.trim();
  if (!message || !currentUserId) return;

  await supabase.from('support_messages').insert([
    {
      user_id: currentUserId,
      message,
      sender: 'admin'
    }
  ]);
  msgInput.value = '';
};
