// Toolbar popup: tells the teacher where the panel appears and opens the right Fedena page.
var PAGE = '/remarks/add_employee_custom_remarks';
var DEFAULT_ORIGIN = 'https://gmis.fedena.com';

chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
  var tab = tabs[0], url;
  try { url = new URL(tab.url); } catch (e) { url = null; }
  var onFedena = url && /\.fedena\.com$/.test(url.hostname);
  var onPage = onFedena && url.pathname.indexOf(PAGE) === 0;
  var msg = document.getElementById('msg');
  var go = document.getElementById('go');

  if (onPage) {
    msg.textContent = 'You are on the right page. Choose the Grade and Batch — the Remarks Helper panel appears at the bottom right.';
    go.textContent = 'Close';
    go.onclick = function () { window.close(); };
  } else {
    msg.textContent = onFedena
      ? 'The panel only appears on Remarks → Add custom remarks.'
      : 'Log in to Fedena first, then open Remarks → Add custom remarks.';
    go.onclick = function () {
      chrome.tabs.update(tab.id, { url: (onFedena ? url.origin : DEFAULT_ORIGIN) + PAGE });
      window.close();
    };
  }
});
