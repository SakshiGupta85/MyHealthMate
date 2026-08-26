const express = require("express");
const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");
const session = require("express-session");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            maxAge: 1000 * 60 * 60 * 24
        }
    })
);

app.use(express.static(path.join(__dirname, "public")));

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
});

/* -------------------------
   TEST DATABASE CONNECTION
------------------------- */

async function testDatabase() {
    try {
        const connection = await pool.getConnection();
        console.log("MySQL connected successfully.");
        connection.release();
    } catch (error) {
        console.error("MySQL connection failed:", error.message);
    }
}

testDatabase();

/* -------------------------
   REGISTER
------------------------- */

app.post("/api/register", async (req, res) => {

    try {

        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                message: "All fields are required."
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                message: "Password must contain at least 6 characters."
            });
        }

        const [existing] = await pool.execute(
            "SELECT id FROM users WHERE email = ?",
            [email]
        );

        if (existing.length > 0) {
            return res.status(400).json({
                message: "Email already registered."
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await pool.execute(
            `INSERT INTO users (name, email, password)
             VALUES (?, ?, ?)`,
            [name, email, hashedPassword]
        );

        res.json({
            success: true,
            message: "Registration successful."
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Server error."
        });
    }
});

/* -------------------------
   LOGIN
------------------------- */

app.post("/api/login", async (req, res) => {

    try {

        const { email, password } = req.body;

        const [rows] = await pool.execute(
            "SELECT * FROM users WHERE email = ?",
            [email]
        );

        if (rows.length === 0) {
            return res.status(401).json({
                message: "Invalid email or password."
            });
        }

        const user = rows[0];

        const passwordMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatch) {
            return res.status(401).json({
                message: "Invalid email or password."
            });
        }

        req.session.userId = user.id;
        req.session.userName = user.name;

        res.json({
            success: true,
            message: "Login successful.",
            name: user.name
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Server error."
        });
    }
});

/* -------------------------
   CHECK LOGIN
------------------------- */

app.get("/api/me", async (req, res) => {

    if (!req.session.userId) {
        return res.status(401).json({
            loggedIn: false
        });
    }

    res.json({
        loggedIn: true,
        name: req.session.userName
    });
});

/* -------------------------
   LOGOUT
------------------------- */

app.get("/api/logout", (req, res) => {

    req.session.destroy(() => {

        res.json({
            success: true
        });

    });
});

/* -------------------------
   CALCULATE HEALTH SCORE
------------------------- */

function calculateBalance(data) {

    let score = 50;

    // Sleep
    if (data.sleep_hours >= 7 && data.sleep_hours <= 9) {
        score += 12;
    } else if (data.sleep_hours >= 6) {
        score += 5;
    } else {
        score -= 10;
    }

    // Sleep quality
    score += (data.sleep_quality - 3) * 4;

    // Energy
    score += (data.energy_level - 3) * 5;

    // Stress
    score -= (data.stress_level - 3) * 5;

    // Hydration
    score += (data.hydration_level - 3) * 3;

    // Meal regularity
    score += (data.meal_regular - 3) * 3;

    // Screen load
    score -= (data.screen_load - 3) * 4;

    // Demanding tasks
    if (data.demanding_tasks >= 4) {
        score -= 8;
    } else if (data.demanding_tasks >= 2) {
        score -= 3;
    }

    score = Math.max(0, Math.min(100, Math.round(score)));

    let status;
    let recommendation;

    if (score >= 75) {

        status = "Ready for Deep Work";

        recommendation =
            "Your current balance supports demanding mental work. Place your most important task during your highest-energy period and use short recovery breaks between focused sessions.";

    } else if (score >= 50) {

        status = "Balanced Work";

        recommendation =
            "Your condition is reasonably balanced. Mix focused tasks with lighter activities and avoid scheduling several demanding tasks continuously.";

    } else {

        status = "Recovery First";

        recommendation =
            "Your current balance suggests reducing cognitive load. Prioritize recovery, regular meals, hydration, short screen breaks and lighter tasks before intensive work.";

    }

    return {
        score,
        status,
        recommendation
    };
}

/* -------------------------
   DAILY CHECK-IN
------------------------- */

app.post("/api/checkin", async (req, res) => {

    if (!req.session.userId) {
        return res.status(401).json({
            message: "Please login first."
        });
    }

    try {

        const data = req.body;

        const result = calculateBalance(data);

        await pool.execute(
            `INSERT INTO daily_checkins
            (
                user_id,
                checkin_date,
                sleep_hours,
                sleep_quality,
                energy_level,
                stress_level,
                hydration_level,
                meal_regular,
                screen_load,
                demanding_tasks,
                balance_score,
                status,
                recommendation
            )
            VALUES (?, CURDATE(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                req.session.userId,
                data.sleep_hours,
                data.sleep_quality,
                data.energy_level,
                data.stress_level,
                data.hydration_level,
                data.meal_regular,
                data.screen_load,
                data.demanding_tasks,
                result.score,
                result.status,
                result.recommendation
            ]
        );

        res.json({
            success: true,
            score: result.score,
            status: result.status,
            recommendation: result.recommendation
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Could not save check-in."
        });
    }
});

/* -------------------------
   HISTORY
------------------------- */

app.get("/api/history", async (req, res) => {

    if (!req.session.userId) {
        return res.status(401).json({
            message: "Please login first."
        });
    }

    try {

        const [rows] = await pool.execute(
            `SELECT
                checkin_date,
                balance_score,
                status,
                sleep_hours,
                energy_level,
                stress_level
             FROM daily_checkins
             WHERE user_id = ?
             ORDER BY checkin_date DESC
             LIMIT 10`,
            [req.session.userId]
        );

        res.json(rows);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Could not load history."
        });
    }
});

/* -------------------------
   START SERVER
------------------------- */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

    console.log(`My Health Mate running at http://localhost:${PORT}`);

});