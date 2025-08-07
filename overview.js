import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://nsbuezwakcyxgvrwiela.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zYnVlendha2N5eGd2cndpZWxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1NTcwMjUsImV4cCI6MjA3MDEzMzAyNX0.L33UWCIRi5CS1cenMfw6EYOzrGg2k_OK8wVukEE4WLI'; // Replace with your anon key
const supabase = createClient(supabaseUrl, supabaseKey);

// Elements
const totalMessagesEl = document.getElementById('totalMessages');
const activeUsersEl = document.getElementById('activeUsers');
const avgResponseTimeEl = document.getElementById('avgResponseTime');
const openConversationsEl = document.getElementById('openConversations');
const recentConversationsBody = document.getElementById('recentConversationsBody');

let messagesChart, usersChart;

async function loadDashboard() {
  // 1. Total Messages
  const { data: messages } = await supabase
    .from('support_messages')
    .select('*');

  totalMessagesEl.textContent = messages?.length || 0;

  // 2. Active Users
  const userIds = [...new Set(messages.map((m) => m.user_id))];
  activeUsersEl.textContent = userIds.length;

  // 3. Open Conversations (count users with last message sender 'user' - assuming open means user waiting)
  const lastMessagesByUser = {};
  messages.forEach((msg) => {
    if (
      !lastMessagesByUser[msg.user_id] ||
      new Date(msg.created_at) > new Date(lastMessagesByUser[msg.user_id].created_at)
    ) {
      lastMessagesByUser[msg.user_id] = msg;
    }
  });

  const openConversations = Object.values(lastMessagesByUser).filter(
    (msg) => msg.sender === 'user'
  ).length;
  openConversationsEl.textContent = openConversations;

  // 4. Avg Response Time (calculate time difference between user message and next support reply)
  let totalResponseTime = 0;
  let responseCount = 0;

  // Group messages by user and order by created_at
  const messagesByUser = {};
  messages.forEach((msg) => {
    if (!messagesByUser[msg.user_id]) messagesByUser[msg.user_id] = [];
    messagesByUser[msg.user_id].push(msg);
  });
  Object.values(messagesByUser).forEach((userMsgs) => {
    userMsgs.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    for (let i = 0; i < userMsgs.length - 1; i++) {
      if (userMsgs[i].sender === 'user' && userMsgs[i + 1].sender === 'support') {
        const diff =
          new Date(userMsgs[i + 1].created_at) - new Date(userMsgs[i].created_at);
        totalResponseTime += diff;
        responseCount++;
      }
    }
  });

  if (responseCount > 0) {
    const avgMs = totalResponseTime / responseCount;
    const avgMinutes = Math.round(avgMs / 60000);
    avgResponseTimeEl.textContent = avgMinutes + ' min';
  } else {
    avgResponseTimeEl.textContent = '--';
  }

  // 5. Render Charts
  renderMessagesChart(messages);
  renderUsersChart(messagesByUser);

  // 6. Recent Conversations (last 10 by created_at)
  const sortedMessages = [...messages].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );
  const recentUserIds = [...new Set(sortedMessages.map((msg) => msg.user_id))].slice(0, 10);

  recentConversationsBody.innerHTML = '';

  for (const userId of recentUserIds) {
    // Find last message by user
    const lastMsg = sortedMessages.find((msg) => msg.user_id === userId);

    // Status logic (open if last sender is user, else closed)
    const status = lastMessagesByUser[userId].sender === 'user' ? 'Open' : 'Closed';

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50';

    tr.innerHTML = `
      <td class="border px-4 py-2 font-mono text-sm">${userId.slice(0, 10)}...</td>
      <td class="border px-4 py-2">${lastMsg.message}</td>
      <td class="border px-4 py-2">${new Date(lastMsg.created_at).toLocaleString()}</td>
      <td class="border px-4 py-2 font-semibold ${status === 'Open' ? 'text-red-600' : 'text-green-600'}">${status}</td>
    `;

    recentConversationsBody.appendChild(tr);
  }
}

// Messages per day line chart
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

  messages.forEach((msg) => {
    const msgDate = new Date(msg.created_at);
    const label = msgDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const index = dayLabels.indexOf(label);
    if (index >= 0) dayCounts[index]++;
  });

  if (messagesChart) messagesChart.destroy();

  const ctx = document.getElementById('messagesChart').getContext('2d');
  messagesChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dayLabels,
      datasets: [
        {
          label: 'Messages',
          data: dayCounts,
          fill: true,
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 2,
          pointRadius: 3,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: true } },
      scales: {
        y: { beginAtZero: true, precision: 0 },
      },
    },
  });
}

// Top users bar chart
function renderUsersChart(messagesByUser) {
  // Sort users by message count desc, top 7
  const usersSorted = Object.entries(messagesByUser)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 7);

  const labels = usersSorted.map(([userId]) => userId.slice(0, 10));
  const data = usersSorted.map(([, msgs]) => msgs.length);

  if (usersChart) usersChart.destroy();

  const ctx = document.getElementById('usersChart').getContext('2d');
  usersChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Messages Count',
          data,
          backgroundColor: 'rgba(34, 197, 94, 0.7)',
          borderColor: 'rgba(34, 197, 94, 1)',
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, precision: 0 },
      },
    },
  });
}

// Load dashboard on page load
window.onload = loadDashboard;
