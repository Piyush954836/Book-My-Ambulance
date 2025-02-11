const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const Driver = require('../models/Driver');
const multer = require('multer');

// Configure Multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Driver registration route
router.post('/driver-register', upload.single('drivingLicensePhoto'), async (req, res) => {
    try {
        const { name, email, contactNumber, age, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);

        const drivingLicensePhoto = req.file
            ? { data: req.file.buffer, contentType: req.file.mimetype }
            : null;

        const newDriver = new Driver({
            name,
            email,
            contactNumber,
            age,
            password: hashedPassword,
            drivingLicensePhoto,
            isActive: false, // Initially set as inactive
            location: null,  // No initial location
        });

        await newDriver.save();
        res.redirect('/driver-login');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error registering driver');
    }
});

// Driver login route
router.post('/driver-login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const driver = await Driver.findOne({ email });

        if (!driver) {
            req.flash('error_msg', 'Invalid email or password');
            return res.render('driver-login');
        }

        const isMatch = await bcrypt.compare(password, driver.password);
        if (!isMatch) {
            req.flash('error_msg', 'Invalid email or password');
            return res.render('driver-login');
        }

        req.session.driverId = driver._id;
        req.flash('success_msg', 'Login successful!');
        res.redirect('/driver-dashboard');
    } catch (error) {
        req.flash('error_msg', 'Something went wrong');
        res.render('driver-login');
    }
});

router.get('/driver-dashboard', (req, res) => {
    const success_msg = req.flash('success_msg');
    res.render('driver-dashboard', { success_msg });
});

// Update driver availability
router.post('/available-driver', async (req, res) => {
    try {
        const { driverId, latitude, longitude, isActive } = req.body;
        if (!driverId) {
            return res.status(400).json({ success: false, message: 'Driver ID is required' });
        }

        const driver = await Driver.findById(driverId);
        if (!driver) {
            return res.status(404).json({ success: false, message: 'Driver not found' });
        }

        driver.isActive = isActive;
        driver.location = isActive ? { latitude, longitude } : null;
        await driver.save();

        res.json({
            success: true,
            message: `Driver is now ${isActive ? 'active' : 'inactive'}`,
            driver,
        });
    } catch (error) {
        console.error('Error updating driver status:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Fetch available drivers sorted by distance

router.get("/:id", async (req, res) => {
    try {
        const driver = await Driver.findById(req.params.id);
        if (!driver) return res.status(404).send("Driver not found");
        res.render("available-driver", { driver });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
});


module.exports = router;
