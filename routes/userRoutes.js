const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Appointment = require("../models/Appointment");
const ensureAuthenticated = require('../middleware/userLoggedIn');
const mongoose = require("mongoose");


// Route protected by middleware for accessing the department page
router.get('/department', ensureAuthenticated, (req, res) => {
    res.render('department');
});

// Registration route
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, latitude, longitude, username } = req.body;

        // Check if the user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.render('user-login', { error: 'Email already registered' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Create a new user
        const user = new User({ name, email, username, password: hashedPassword, latitude, longitude });
        await user.save();

        res.render('index', { success: 'Registration successful! Please log in.', user });
    } catch (error) {
        console.error(error);
        res.render('user-login', { error: 'An error occurred during registration. Please try again.' });
    }
});

// Login route
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check if the user exists
        const user = await User.findOne({ email });
        if (!user) {
            req.flash('error_msg', 'Invalid email or password');
            return res.render('user-login');
        }

        // Compare passwords
        const isPasswordCorrect = await bcrypt.compare(password, user.password);
        if (!isPasswordCorrect) {
            req.flash('error_msg', 'Invalid email or password');
            return res.render('user-login');
        }

        // Store only the user ID (not the whole user object) in the session
        req.session.userId = user._id;  // Store just the user ID in the session
        req.session.user = user;  // Store just the user ID in the session
        req.flash('success_msg', 'Login successful!');

        const success_msg = req.flash('success_msg');
        res.render('department', {success_msg, user });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Something went wrong');
        res.render('user-login');
    }
});



router.get("/dashboard", ensureAuthenticated, async (req, res) => {
    try {
        // if (!req.session.user) {
        //     return res.redirect("/user-login");
        // }

        const userId = req.session.user._id;

        const appointments = await Appointment.find({ patientId: userId }).populate("doctorId");

        res.render("user-dashboard", { appointments, user: req.session.user });
    } catch (error) {
        console.error("Error fetching appointments:", error);
        res.status(500).send("Server Error");
    }
});


router.get("/:userId/appointments", async (req, res) => {
    try {
        const appointments = await Appointment.find({ patientId: req.params.userId }).populate("doctorId");
        res.json(appointments);
    } catch (error) {
        console.error("Error fetching appointments:", error);
        res.status(500).json({ error: "Server error" });
    }
});

router.get('/doctors', ensureAuthenticated, async (req, res) => {
    try {
        console.log("Session UserID:", req.session.userId); // Debugging

        const { department, searchQuery } = req.query;
        let doctors;

        const searchConditions = {};

        // If a department filter is provided, add it to the query
        if (department) {
            searchConditions.department = department;
        }

        // If a search query is provided, add it to the query to filter by name, department, or hospital
        if (searchQuery) {
            const searchRegex = new RegExp(searchQuery, 'i'); // Case-insensitive search

            searchConditions.$or = [
                { fullName: searchRegex },  // Search by doctor's name
                { department: searchRegex }, // Search by department
                { 'hospital.name': searchRegex } // Search by hospital name
            ];
        }

        // Fetch doctors based on the search conditions
        doctors = await Doctor.find(searchConditions);

        if (!doctors || doctors.length === 0) {
            return res.status(404).send('No doctors found');
        }

        // Fetch user details from database using userId stored in session
        let user = null;
        if (req.session.userId) {
            user = await User.findById(req.session.userId);
        }

        res.render('available-doctor', { user, doctors, department, searchQuery }); // Pass searchQuery along with other variables
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});


module.exports = router;
