const mongoose = require("mongoose");
const Lead = require("./Backend/models/Lead");

mongoose.connect("mongodb://127.0.0.1:27017/newcrm", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(async () => {
        console.log("Connected to MongoDB.");

        // Create first lead without website
        try {
            const lead1 = new Lead({
                company_name: "Test Corp One",
                status: "incomplete",
                assignedBy: new mongoose.Types.ObjectId()
            });
            await lead1.save();
            console.log("Created lead 1 without website successfully");

            const lead2 = new Lead({
                company_name: "Test Corp Two",
                status: "incomplete",
                assignedBy: new mongoose.Types.ObjectId()
            });
            await lead2.save();
            console.log("Created lead 2 without website successfully (proving sparse works)");

            // Clean up testing
            await Lead.deleteMany({ company_name: { $in: ["Test Corp One", "Test Corp Two"] } });
            console.log("Testing complete and cleaned up");
        } catch (e) {
            console.error("Test error:", e.message);
        }

        mongoose.disconnect();
    })
    .catch(err => {
        console.error("Connection error:", err);
    });
