const express = require('express');
const router = express.Router();
const Doctor = require('../models/Doctor');
const Hospital = require('../models/Hospital'); // Import Hospital model
const User = require('../models/User');
const bcrypt = require('bcrypt');
const multer = require('multer');

// Configure Multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

// SEARCH DOCTOR
router.get("/search", async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) return res.json([]); 

        const doctors = await Doctor.find({
            $or: [
                { fullName: { $regex: query, $options: "i" } },
                { department: { $regex: query, $options: "i" } },
                { hospital: { $regex: query, $options: "i" } }
            ]
        }).limit(10);

        res.json(doctors);
    } catch (error) {
        console.error("Error searching doctors:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Doctor registration route
router.post('/doctor-register', upload.single('profilePicture'), async (req, res) => {
    try {
        const { fullName, email, contact, hospital, password, department, shift } = req.body;

        // Validate hospital existence
        const hospitalExists = await Hospital.findById(hospital);
        if (!hospitalExists) {
            req.flash('error_msg', 'Invalid hospital selection');
            return res.redirect('/doctor-register');
        }

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
            hospital: hospitalExists._id, // Store hospital ID reference
            password: hashedPassword,  
            department,
            profilePicture,
            shift
        });

        await newDoctor.save();
        req.flash('success_msg', 'Doctor registered successfully');
        res.redirect('/doctor-login');
    } catch (error) {
        console.error("Doctor registration error:", error);
        res.status(500).send('Error registering doctor');
    }
});

// Fetch doctor's profile picture
router.get('/doctor-profile/:id/profile-picture', async (req, res) => {
    try {
        const doctor = await Doctor.findById(req.params.id);
        if (!doctor || !doctor.profilePicture?.data) {
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
        const doctor = await Doctor.findOne({ email }).populate('hospital');
        

        if (!doctor || !(await bcrypt.compare(password, doctor.password))) {
            req.flash('error_msg', 'Invalid email or password');
            return res.redirect('/doctor-login');
        }

        // Store doctor ID in session
        req.session.doctorId = doctor._id;
        req.flash('success_msg', 'Login successful!');
        res.redirect('/doctor-dashboard');
    } catch (error) {
        console.error("Doctor login error:", error);
        req.flash('error_msg', 'Something went wrong');
        res.redirect('/doctor-login');
    }
});

// Get doctors by department
router.get('/', async (req, res) => {
    try {
        const { department } = req.query;
        const doctors = await Doctor.find({ department }).populate('hospital');

        if (!doctors.length) {
            return res.status(404).send('No doctors found for this department');
        }

        let user = null;
        if (req.session.userId) {
            user = await User.findById(req.session.userId);
        }

        res.render('available-doctor', { user, doctors, department });
    } catch (error) {
        console.error("Error fetching doctors:", error);
        res.status(500).send('Internal Server Error');
    }
});

// Update doctor's availability status
router.post('/update-status', async (req, res) => {
    try {
        const { status } = req.body;
        const doctor = await Doctor.findById(req.session.doctorId);
        if (!doctor) {
            return res.status(404).json({ success: false, message: 'Doctor not found' });
        }

        doctor.status = status;
        await doctor.save();

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating status:', error);
        res.status(500).json({ success: false, message: 'Error updating status' });
    }
});

// Doctor dashboard route
router.get('/doctor-dashboard', async (req, res) => {
    try {
        if (!req.session.doctorId) {
            req.flash('error_msg', 'Please log in to view this page');
            return res.redirect('/doctor-login');
        }

        const doctor = await Doctor.findById(req.session.doctorId).populate('hospital');

        if (!doctor) {
            req.flash('error_msg', 'Doctor not found');
            return res.redirect('/doctor-login');
        }

        res.render('doctor-dashboard', { doctor });
    } catch (error) {
        console.error("Doctor dashboard error:", error);
        req.flash('error_msg', 'Something went wrong');
        res.redirect('/doctor-login');
    }
});

module.exports = router;
