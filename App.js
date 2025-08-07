import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabase = createClient(
  'https://nsbuezwakcyxgvrwiela.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zYnVlendha2N5eGd2cndpZWxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1NTcwMjUsImV4cCI6MjA3MDEzMzAyNX0.L33UWCIRi5CS1cenMfw6EYOzrGg2k_OK8wVukEE4WLI'
);

const userList = document.getElementById('userList');
const chatWindow = document.getElementById('chatWindow');
const chatHeader = document.getElementById('chatHeader');
let selectedUserId = null;

async function loadUsers() {
  const { data, error } = await supabase
    .from('support_messages')
    .select('user_id')
    .neq('sender', 'agent')
    .group('user_id');

  if (error) {
    console.error(error);
    return;
  }

  userList.innerHTML = '';
  data.forEach(({ user_id }) => {
    const btn = document.createElement('button');
    btn.className = 'w-full p-2 text-left bg-gray-100 rounded hover:bg-gray-200';
    btn.innerText = user_id;
    btn.onclick = () => selectUser(user_id);
    userList.appendChild(btn);
  });
}

async function selectUser(userId) {
  selectedUserId = userId;
  chatHeader.innerText = `Chat with: ${userId}`;
  await renderChat();
}

async function renderChat() {
  if (!selectedUserId) return;

  const { data } = await supabase
    .from('support_messages')
    .select('*')
    .eq('user_id', selectedUserId)
    .order('created_at', { ascending: true });

  chatWindow.innerHTML = '';
  data.forEach((m) => {
    const div = document.createElement('div');
    const bubbleClass = m.sender === 'agent'
      ? 'bg-blue-100 text-right'
      : 'bg-gray-200 text-left';
    div.className = `mb-2 p-2 rounded max-w-xs ${bubbleClass}`;
    div.innerText = m.message;
    chatWindow.append(div);
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
};

supabase
  .channel('support-chat')
  .on('postgres_changes', { event: 'INSERT', table: 'support_messages', schema: 'public' }, async (payload) => {
    if (payload.new.user_id === selectedUserId) {
      await renderChat();
    }
    await loadUsers();
  })
  .subscribe();

loadUsers();
