window.addEventListener("DOMContentLoaded", function () {
    document.getElementById("tema_toggle").addEventListener("change", function () {
        document.body.classList.toggle("dark");
        if (document.body.classList.contains("dark")) {
            localStorage.setItem("tema", "dark");
        } else {
            localStorage.removeItem("tema");
        }
    });
  
    // Check local storage for theme preference on page load
    let tema = localStorage.getItem("tema");
    if (tema === "dark") {
        document.body.classList.add("dark");
    }
  });




