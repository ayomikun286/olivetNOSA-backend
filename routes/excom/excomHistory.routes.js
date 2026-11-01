import express from "express";

import {
    getAllPresidentialTenures,
    getPresidentialTenureDetails,
     exportPresidentialTenurePDF,
} from "../../controller/excom/excomHistory.controller.js";


import {
    assignExcomMember,
    getExcomMembers,
    updateExcomMember,
    removeExcomMember,
} from "../../controller/excom/adminExcomMembership.controller.js";



import {protect} from "../../middleware/authmiddleware.js";
import requireRole from "../../middleware/roleMiddleware.js";

const router = express.Router();

router.use(protect, requireRole("superAdmin"));

router.get("/tenures", getAllPresidentialTenures);

router.get("/tenures/:tenureId", getPresidentialTenureDetails);

router.get(
    "/tenures/:tenureId/export",
    exportPresidentialTenurePDF
);


// EXCOM Membership Management
router.post("/members", assignExcomMember);

router.get("/tenures/:tenureId/members", getExcomMembers);

router.patch("/members/:membershipId", updateExcomMember);

router.patch("/members/:membershipId/remove", removeExcomMember);



export default router;