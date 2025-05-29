const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const Driver = require('../models/Driver');
const Hospital = require('../models/Hospital'); // Import Hospital model
const multer = require('multer');
const mongoose = require('mongoose');
const { ObjectId } = require('mongoose').Types;

// Configure Multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Driver registration route
router.post('/driver-register', upload.single('drivingLicensePhoto'), async (req, res) => {
    try {
        const { name, email, contactNumber, age, password, hospital, shift } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);

        const hospitalExists = await Hospital.findById(hospital);
        if (!hospitalExists) {
            req.flash('error_msg', 'Invalid hospital selection');
            return res.redirect('/doctor-register');
        }

        const drivingLicensePhoto = req.file
            ? { data: req.file.buffer, contentType: req.file.mimetype }
            : null;

        const newDriver = new Driver({
            name,
            email,
            contactNumber,
            age,
            hospital: hospitalExists._id,
            password: hashedPassword,
            drivingLicensePhoto,
            isActive: false, // Initially set as inactive
            location: null,  // No initial location
            shift
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

router.get('/:driverId/location', async (req, res) => {
    try {
        const { driverId } = req.params;
        const driver = await Driver.findById(driverId);

        if (!driver || !driver.location) {
            return res.status(404).json({ error: "Driver location not found" });
        }

        res.json({ latitude: driver.location.latitude, longitude: driver.location.longitude });
    } catch (error) {
        console.error("Error fetching driver location:", error);
        res.status(500).json({ error: "Server error" });
    }
});

router.post("/update-location", async (req, res) => {
    const { driverId, latitude, longitude } = req.body;

    if (!driverId || !latitude || !longitude) {
        return res.status(400).send("All fields are required");
    }

    try {
        await Driver.findByIdAndUpdate(driverId, {
            location: { latitude, longitude }
        });
        res.send("Location updated");
    } catch (error) {
        console.error("Error updating driver location:", error);
        res.status(500).send("Server error");
    }
});

function getDistance(lat1, lon1, lat2, lon2) {
    
    const toRad = (value) => (value * Math.PI) / 180;
    const R = 6371; // Earth radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance;
}

router.get("/emergency", async (req, res) => {
    try {
        console.log("Emergency route accessed");

        if (!req.session.userLocation) {
            console.log("User location not found in session");
            return res.status(400).send("User location not found");
        }

        const { latitude, longitude } = req.session.userLocation;

        // Get all active drivers with valid locations
        let drivers = await Driver.find({ isActive: true, location: { $ne: null } });

        // Calculate distance for each driver
        drivers = drivers.map(driver => {
            if (driver.location) {
                const distance = getDistance(latitude, longitude, driver.location.latitude, driver.location.longitude);
                return { ...driver.toObject(), distance };
            }
            return null;
        }).filter(driver => driver !== null);

        // Sort drivers based on distance
        drivers.sort((a, b) => a.distance - b.distance);

        // If no drivers available, return an empty list
        if (drivers.length === 0) {
            return res.render("emergency", { drivers: [], nearestDriver: null, userLat: latitude, userLng: longitude });
        }

        res.render("emergency", { 
            drivers,  // List of all drivers
            nearestDriver: drivers[0], // Closest driver
            userLat: latitude, 
            userLng: longitude 
        });

    } catch (error) {
        console.error("Error in emergency route:", error);
        res.status(500).send("Server error");
    }
});


router.get("/emergency-data", async (req, res) => {
    try {
        if (!req.session.userLocation) {
            return res.status(400).json({ error: "User location not found" });
        }

        const { latitude, longitude } = req.session.userLocation;
        let drivers = await Driver.find({ isActive: true, location: { $ne: null } });

        drivers = drivers.map(driver => {
            if (driver.location) {
                const distance = getDistance(latitude, longitude, driver.location.latitude, driver.location.longitude);
                return { ...driver.toObject(), distance };
            }
            return null;
        }).filter(driver => driver !== null);

        drivers.sort((a, b) => a.distance - b.distance);

        res.json(drivers);
    } catch (error) {
        console.error("Error in emergency-data route:", error);
        res.status(500).json({ error: "Server error" });
    }
});

// ✅ Render the driver map page
router.get("/driver-map", async (req, res) => {
    try {
         let { bookingId, driverId } = req.query;

        if (!driverId) {
            driverId = req.session.driverId; // Fallback to session if not in query
        } // Retrieve driverId from session
        

        console.log("📦 driverId:", driverId, "Valid:", ObjectId.isValid(driverId));

        if (!driverId || !ObjectId.isValid(driverId)) {
            console.error("❌ ERROR: Invalid Driver ID:", driverId);
            return res.status(400).send("Invalid Driver ID");
        }   

        res.render("driver-map", { driverId, bookingId: bookingId || null });
    } catch (error) {
        console.error("❌ ERROR rendering driver-map:", error);
        res.status(500).send("Internal Server Error");
    }
});

router.post("/accept-booking", (req, res) => {
    try {
        const driverId = req.query.driverId || req.session.driverId;
        const bookingId = req.query.bookingId;

        if (!driverId || !ObjectId.isValid(driverId)) {
            console.error("❌ ERROR: Invalid Driver ID:", driverId);
            return res.status(400).json({ error: "Invalid Driver ID" });
        }

        if (!bookingId || !ObjectId.isValid(bookingId)) {
            console.error("❌ ERROR: Invalid Booking ID received:", bookingId);
            return res.status(400).json({ error: "Invalid Booking ID" });
        }

        console.log(`✅ Driver ${driverId} accepted booking: ${bookingId}`);

        // Emit event to notify user
        const io = req.app.get("socketio");
        io.to(driverId).emit("bookingAccepted", { driverId, bookingId });

        res.json({ 
            success: true, 
            redirectUrl: `/driver/map?bookingId=${bookingId}&driverId=${driverId}` // ✅ Now includes driverId
        });
    } catch (error) {
        console.error("❌ ERROR accepting booking:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});


// router.get("/:id", async (req, res) => {
//     try {
//         console.log("Received IDs:", req.params.id);

//         const driverId = req.params.id;

//         if (!mongoose.Types.ObjectId.isValid(driverId)) {
//             console.log("Invalid ObjectId:", driverId);
//             return res.status(400).send("Invalid driver ID");
//         }

//         const driver = await Driver.findById(driverId);
//         if (!driver) return res.status(404).send("Driver not found");

//         res.render("available-driver", { drivers: driver });
//     } catch (error) {
//         console.error(error);
//         res.status(500).send("Internal Server Error");
//     }
// });
let userLocation = { lat: 0, lng: 0 };
let driverLocations = {}; // Store driver locations by driver ID

// ✅ API to fetch user's location
router.get("/get-user-location", (req, res) => {
    res.json(userLocation);
});

// ✅ API to update driver location via fetch (Live Tracking)
router.post("/update-location", (req, res) => {
    try {
        const { driverId, latitude, longitude } = req.body;

        if (!driverId || !ObjectId.isValid(driverId)) {
            return res.status(400).json({ error: "Invalid Driver ID" });
        }

        driverLocations[driverId] = { lat: latitude, lng: longitude };
        console.log(`📍 Live Driver ${driverId} updated location:`, { latitude, longitude });

        res.json({ success: true });
    } catch (error) {
        console.error("❌ ERROR updating driver location:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ✅ API to simulate updating user location (for testing)
router.post("/update-user-location", (req, res) => {
    const { lat, lng } = req.body;
    userLocation = { lat, lng };
    console.log("📍 User location updated:", userLocation);

    res.json({ success: true });
});




module.exports = router;
