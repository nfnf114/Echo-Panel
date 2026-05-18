window.addEventListener('message', function(event) {
  if (event.data.action === "showDM") {
    showNotification(event.data.message);
  }
});

function showNotification(message) {
  const container = document.getElementById('notifications');
  const notif = document.createElement('div');
  notif.className = 'notification';
  notif.innerHTML = `
    <div class="title">رسالة من الإدارة</div>
    <div class="message">${message}</div>
  `;
  container.appendChild(notif);

  fetch(`https://${GetParentResourceName()}/playSound`, { method: 'POST', body: JSON.stringify({}) }).catch(()=>{});

  setTimeout(() => {
    notif.classList.add('hide');
    setTimeout(() => {
      notif.remove();
    }, 500);
  }, 10000);
}
