// routes/locationRoutes.js

const express = require('express');
const router = express.Router();
const Location = require('../models/Location');

// Endpoint to update user or driver location
router.post('/update-location', async (req, res) => {
    try {
        const { lat, lng, type, userId } = req.body;

        if (!lat || !lng || !type || !userId) {
            return res.status(400).json({ message: 'All fields are required.' });
        }

        // Find or create location for user/driver
        let location = await Location.findOne({ userId, type });

        if (location) {
            // If location exists, update it
            location.lat = lat;
            location.lng = lng;
            location.updatedAt = Date.now();
            await location.save();
        } else {
            // Create a new location record if not exists
            location = new Location({ lat, lng, type, userId });
            await location.save();
        }

        res.status(200).json({ message: 'Location updated successfully.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});


router.get('/get-driver-location', async (req, res) => {
    try {
        const driverLocation = await Location.findOne({ type: 'driver' }).sort({ updatedAt: -1 });

        if (!driverLocation) {
            return res.status(404).json({ message: 'Driver location not found.' });
        }

        res.status(200).json({ lat: driverLocation.lat, lng: driverLocation.lng });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Endpoint to get user's real-time location
router.get('/get-user-location', async (req, res) => {
    try {
        const userLocation = await Location.findOne({ type: 'user' }).sort({ updatedAt: -1 });

        if (!userLocation) {
            return res.status(404).json({ message: 'User location not found.' });
        }

        res.status(200).json({ lat: userLocation.lat, lng: userLocation.lng });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
