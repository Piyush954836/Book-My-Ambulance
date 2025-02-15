const express = require("express");
const bcrypt = require("bcryptjs");
const Hospital = require("../models/Hospital");
const Doctor = require("../models/Doctor");
const Driver = require("../models/Driver");
const ensureAuthenticated = require('../middleware/userLoggedIn');


const router = express.Router();

// 🔹 Hospital Registration Route
router.post("/register", async (req, res) => {
  try {
    const { name, address, contact, responsiblePerson, role, email, password, latitude, longitude } = req.body;

    // Check if hospital already exists
    const existingHospital = await Hospital.findOne({ email });
    if (existingHospital) {
      return res.status(400).json({ message: "Hospital already registered!" });
    }

    // Hash password before saving
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new hospital entry
    const newHospital = new Hospital({
      name,
      address,
      contact,
      responsiblePerson,
      role,
      email,
      password: hashedPassword,
      location: { latitude, longitude }
    });

      // Fetch doctors for this hospital
      const doctors = await Doctor.find({ hospital: existingHospital._id });
      const drivers = await Driver.find({ hospital: existingHospital._id });
  
    await newHospital.save();
    res.render('hospital-dashboard', {hospital: newHospital, doctors, drivers});
  } catch (error) {
    res.status(500).json({ message: "Server Error!", error });
  }
});

// 🔹 Hospital Login Route
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const hospital = await Hospital.findOne({ email });

    if (!hospital) {
      return res.status(404).json({ message: "Hospital not found!" });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, hospital.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials!" });
    }

    // Set session (Login)
    req.session.hospitalId = hospital._id;
    req.session.hospital = hospital;

    // Fetch doctors for this hospital
    const doctors = await Doctor.find({ hospital: hospital._id });
    const drivers = await Driver.find({ hospital: hospital._id });

    // Render dashboard with hospital & doctors data
    res.render("hospital-dashboard", { hospital, doctors, drivers });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server Error!", error });
  }
});

router.get("/hospitals", ensureAuthenticated, async (req, res) => {
  try {
    const hospitals = await Hospital.find();
    res.render("all-hospitals", { hospitals });
  } catch (error) {
    res.status(500).send("Error fetching hospitals");
  }
});

module.exports = router;
