const form = document.getElementById("registerForm");
const message = document.getElementById("message");

form.addEventListener("submit", async function(event) {

    event.preventDefault();

    const name = document.getElementById("name").value;
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    try {

        const response = await fetch("/api/register", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                name,
                email,
                password
            })

        });

        const data = await response.json();

        message.textContent = data.message;

        if (data.success) {

            setTimeout(() => {
                window.location.href = "login.html";
            }, 1000);

        }

    } catch (error) {

        message.textContent =
            "Unable to connect to server.";

    }

});