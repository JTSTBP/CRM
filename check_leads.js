const mongoose = require("mongoose");
const Lead = require("./Backend/models/Lead");

mongoose.connect("mongodb://127.0.0.1:27017/newcrm", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(async () => {
        console.log("Connected to MongoDB.");
        const leads = await Lead.find().sort({ createdAt: -1 }).limit(10);
        console.log("Recent 10 leads:");
        leads.forEach(l => {
            console.log(`- ID: ${l._id}, Name: ${l.company_name}, Website: ${l.website_url}, Status: ${l.status}, Created: ${l.createdAt}`);
            // also check points of contact
            if (l.points_of_contact && l.points_of_contact.length > 0) {
                console.log(`  POCs: ${l.points_of_contact.map(p => p.approvalStatus).join(", ")}`);
            }
        });

        // Check if there are any rejected leads recently
        const rejectedLeads = await Lead.find({ status: 'rejected' }).sort({ createdAt: -1 }).limit(5);
        console.log("\nRecent 5 rejected leads:");
        rejectedLeads.forEach(l => {
            console.log(`- ID: ${l._id}, Name: ${l.company_name}, Website: ${l.website_url}, Status: ${l.status}, Created: ${l.createdAt}`);
        });

        mongoose.disconnect();
    })
    .catch(err => {
        console.error("Connection error:", err);
    });
