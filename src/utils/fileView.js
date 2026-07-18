const VIEWABLE_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

/* Programmatic download via a temporary anchor. */
export function triggerDownload(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/* Open viewable types (PDF / images) in a new tab; download everything else. */
export function viewFile(doc) {
  if (VIEWABLE_TYPES.includes(doc.type)) {
    const win = window.open();
    if (win) {
      win.document.write(
        `<html><head><title>${doc.name}</title></head>` +
        `<body style="margin:0;background:#111">` +
        `<iframe src="${doc.url}" style="width:100%;height:100vh;border:none"></iframe>` +
        `</body></html>`
      );
      win.document.close();
      return;
    }
  }
  triggerDownload(doc.url, doc.name);
}
