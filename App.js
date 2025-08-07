import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabase = createClient(
  'https://nsbuezwakcyxgvrwiela.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zYnVlendha2N5eGd2cndpZWxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1NTcwMjUsImV4cCI6MjA3MDEzMzAyNX0.L33UWCIRi5CS1cenMfw6EYOzrGg2k_OK8wVukEE4WLI'
);

let selectedUserId = null;

const userList = document.getElementById('userList');
const chatWindow = document.getElementById('chatWindow');

async function loadUsers() {
  const { data, error } = await supabase
    .from('support_messages')
    .select('user_id')
    .neq('sender', 'agent')
    .group('user_id');

  userList.innerHTML = '';
  data?.forEach((u) => {
    const btn = document.createElement('button');
    btn.className = 'w-full text-left p-2 bg-gray-100 rounded hover:bg-gray-200';
    btn.innerText = u.user_id;
    btn.onclick = () => loadChat(u.user_id);
    userList.appendChild(btn);
  });
}

async function loadChat(userId) {
  selectedUserId = userId;

  const { data, error } = await supabase
    .from('support_messages')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  renderChat(data || []);
}

function renderChat(messages) {
  chatWindow.innerHTML = '';
  messages.forEach((msg) => {
    const align = msg.sender === 'agent' ? 'text-right' : 'text-left';
    const bg = msg.sender === 'agent' ? 'bg-blue-100' : 'bg-gray-200';
    const bubble = document.createElement('div');
    bubble.className = `${align} mb-2`;
    bubble.innerHTML = `<div class="inline-block ${bg} px-4 py-2 rounded">${msg.message}</div>`;
    chatWindow.appendChild(bubble);
  });
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

window.sendMessage = async function () {
  const input = document.getElementById('msgInput');
  const msg = input.value.trim();
  if (!msg || !selectedUserId) return;

  await supabase.from('support_messages').insert([
    { user_id: selectedUserId, sender: 'agent', message: msg }
  ]);

  input.value = '';
  loadChat(selectedUserId);
};

// Real-time listener
supabase
  .channel('support_chat')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages' }, (payload) => {
    if (payload.new.user_id === selectedUserId) {
      loadChat(selectedUserId);
    }
    loadUsers();
  })
  .subscribe();

loadUsers();
