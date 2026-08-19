(function () {
  try {
    var m = location.search.match(/[?&]ref=([a-zA-Z0-9_-]{1,40})/);
    if (m) {
      var ref = m[1];
      document.querySelectorAll('a[href^="/go?src="]').forEach(function (a) {
        if (a.getAttribute("href").indexOf("ref=") !== -1) return;
        a.href += "&ref=" + encodeURIComponent(ref);
      });
    }
  } catch (e) {}

  var box = document.getElementById("nav-open");
  if (!box) return;

  function sync() {
    document.body.classList.toggle("nav-lock", box.checked);
  }
  box.addEventListener("change", sync);
  sync();

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && box.checked) {
      box.checked = false;
      sync();
    }
  });
})();
