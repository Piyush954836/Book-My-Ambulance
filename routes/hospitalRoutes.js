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

router.post('/update-beds', async (req, res) => {
  try {
      const { totalBeds, availableBeds } = req.body;

      // Ensure availableBeds is not greater than totalBeds
      const sanitizedTotalBeds = parseInt(totalBeds, 10);
      let sanitizedAvailableBeds = parseInt(availableBeds, 10);

      if (sanitizedAvailableBeds > sanitizedTotalBeds) {
          sanitizedAvailableBeds = sanitizedTotalBeds;
      }

      // Find the logged-in hospital (Assuming hospitalId is stored in session)
      const hospital = await Hospital.findById(req.session.hospitalId);
      if (!hospital) {
          return res.status(404).send('Hospital not found');
      }

      // Update hospital bed data
      hospital.totalBeds = sanitizedTotalBeds;
      hospital.availableBeds = sanitizedAvailableBeds;
      await hospital.save();

      // Fetch doctors and drivers for this hospital
      const doctors = await Doctor.find({ hospital: hospital._id });
      const drivers = await Driver.find({ hospital: hospital._id });

      // Render the dashboard with updated data
      res.render('hospital-dashboard', { hospital, doctors, drivers });
  } catch (error) {
      console.error('Error updating beds:', error);
      res.status(500).send('Server error');
  }
});

// 🔹 Hospital Logout Route
router.get("/logout", (req, res) => {
  // Destroy the session to log the hospital out
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: "Error logging out" });
    }
    // Redirect to the login page after logout
    res.redirect("/");  // Adjust the path as needed
  });
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
