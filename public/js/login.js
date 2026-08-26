const form = document.getElementById("loginForm");
const message = document.getElementById("message");

form.addEventListener("submit", async function(event) {

    event.preventDefault();

    const email =
        document.getElementById("email").value;

    const password =
        document.getElementById("password").value;

    try {

        const response = await fetch("/api/login", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                email,
                password
            })

        });

        const data = await response.json();

        message.textContent = data.message;

        if (data.success) {

            window.location.href =
                "dashboard.html";

        }

    } catch (error) {

        message.textContent =
            "Unable to connect to server.";

    }

});