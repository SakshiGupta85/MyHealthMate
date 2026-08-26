async function checkLogin() {

    const response = await fetch("/api/me");

    if (!response.ok) {

        window.location.href = "login.html";
        return;

    }

    const data = await response.json();

    document.getElementById("welcomeUser").textContent =
        "Hi, " + data.name;

}

checkLogin();


const form =
    document.getElementById("checkinForm");


form.addEventListener("submit", async function(event) {

    event.preventDefault();


    const data = {

        sleep_hours:
            parseFloat(
                document.getElementById("sleep_hours").value
            ),

        sleep_quality:
            parseInt(
                document.getElementById("sleep_quality").value
            ),

        energy_level:
            parseInt(
                document.getElementById("energy_level").value
            ),

        stress_level:
            parseInt(
                document.getElementById("stress_level").value
            ),

        hydration_level:
            parseInt(
                document.getElementById("hydration_level").value
            ),

        meal_regular:
            parseInt(
                document.getElementById("meal_regular").value
            ),

        screen_load:
            parseInt(
                document.getElementById("screen_load").value
            ),

        demanding_tasks:
            parseInt(
                document.getElementById("demanding_tasks").value
            )

    };


    const response = await fetch("/api/checkin", {

        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify(data)

    });


    const result = await response.json();


    if (!response.ok) {

        alert(result.message);
        return;

    }


    document.getElementById("result")
        .style.display = "block";


    document.getElementById("score")
        .textContent = result.score;


    document.getElementById("status")
        .textContent = result.status;


    document.getElementById("recommendation")
        .textContent = result.recommendation;


    window.scrollTo({
        top: document.body.scrollHeight,
        behavior: "smooth"
    });

});


document.getElementById("logout")
    .addEventListener("click", async function(event) {

        event.preventDefault();

        await fetch("/api/logout");

        window.location.href = "index.html";

    });