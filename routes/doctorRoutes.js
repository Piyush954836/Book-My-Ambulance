const express = require('express');
const router = express.Router();
const Doctor = require('../models/Doctor');
const bcrypt = require('bcrypt');
const multer = require('multer');

// Configure Multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Doctor registration route
router.post('/doctor-register', upload.single('profilePicture'), async (req, res) => {
    try {
        const { fullName, email, contact, hospital, password, department } = req.body;
        
        // Hash the password before saving it
        const hashedPassword = await bcrypt.hash(password, 10);

        const profilePicture = {
            data: req.file.buffer,
            contentType: req.file.mimetype
        };

        const newDoctor = new Doctor({
            fullName,
            email,
            contact,
            hospital,
            password: hashedPassword,  // Save the hashed password
            department,
            profilePicture
        });

        await newDoctor.save();
        res.redirect('/doctor-login'); // Redirect or send response as needed
    } catch (error) {
        console.error(error);
        res.status(500).send('Error registering doctor');
    }
});

router.get('/doctor-profile/:id/profile-picture', async (req, res) => {
    try {
        console.log("Fetching image for doctor:", req.params.id); // Debugging log

        const doctor = await Doctor.findById(req.params.id);
        if (!doctor || !doctor.profilePicture || !doctor.profilePicture.data) {
            console.log("No profile picture found.");
            return res.redirect('/default-avatar.png'); // Default image
        }

        res.set('Content-Type', doctor.profilePicture.contentType);
        res.send(doctor.profilePicture.data);
    } catch (error) {
        console.error("Error retrieving profile picture:", error);
        res.status(500).send('Error retrieving profile picture');
    }
});


// Doctor login route
router.post('/doctor-login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find the doctor by email
        const doctor = await Doctor.findOne({ email });
        if (!doctor) {
            console.log('Doctor not found for email:', email);
            req.flash('error_msg', 'Invalid email or password');
            return res.redirect('/doctor-login');
        }

        // Check password
        const isMatch = await bcrypt.compare(password, doctor.password);

        if (!isMatch) {
            req.flash('error_msg', 'Invalid email or password');
            return res.redirect('/doctor-login');
        }

        // Password matched, set up session
        req.session.doctorId = doctor._id; // Save doctor ID in session

        req.flash('success_msg', 'Login successful!');
        return res.redirect('/doctor-dashboard');
    } catch (error) {
        req.flash('error_msg', 'Something went wrong');
        return res.redirect('/doctor-login');
    }
});

router.post('/update-status', async (req, res) => {
    try {
        // Get the status from the request body
        const { status } = req.body;

        // Check if the doctor is logged in
        const doctor = await Doctor.findById(req.session.doctorId);
        if (!doctor) {
            return res.status(404).json({ success: false, message: 'Doctor not found' });
        }

        // Update the doctor's status
        doctor.status = status;  // Update status in the doctor object
        await doctor.save();

        // Return a success response
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating status:', error);
        res.status(500).json({ success: false, message: 'Error updating status' });
    }
});


router.get('/doctor-dashboard', async (req, res) => {
    try {
        if (!req.session.doctorId) {
            req.flash('error_msg', 'Please log in to view this page');
            return res.redirect('/doctor-login');
        }

        const doctor = await Doctor.findById(req.session.doctorId);

        if (!doctor) {
            req.flash('error_msg', 'Doctor not found');
            return res.redirect('/doctor-login');
        }

        res.render('doctor-dashboard', { doctor });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Something went wrong');
        res.redirect('/doctor-login');
    }
});



module.exports = router;
