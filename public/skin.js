//hide googlelogin
const hide = () =>
document.querySelectorAll("button, a").forEach((el) => {
    if (/google/i.test(el.textContent)) el.style.display = "none";
});
new MutationObserver(hide).observe(document.documentElement, { childList: true, subtree: true });
hide();
