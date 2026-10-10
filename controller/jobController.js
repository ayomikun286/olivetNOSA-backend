import Job from "../models/Job.js";
import { createAuditLog } from "../services/auditLog.service.js";


const isValidJobId = (id) => /^[0-9a-fA-F]{24}$/.test(id);
const auditJobAction = async (auditData) => {
  try {
    await createAuditLog(auditData);
    return true;
  } catch (error) {
    console.error("Job audit logging failed:", {
      action: auditData.action,
      resourceId: auditData.resourceId,
      error: error.message,
    });

    return false;
  }
};

const getJobData = (body) => ({
  title: body.title,
  company: body.company,
  location: body.location,
  employmentType: body.employmentType,
  description: body.description,
  applicationUrl: body.applicationUrl || "",
  applicationEmail: body.applicationEmail || "",
  deadline: body.deadline,
  status: body.status,
});

const validateJobData = (data) => {
  const requiredFields = [
    "title",
    "company",
    "location",
    "employmentType",
    "description",
    "deadline",
  ];

  for (const field of requiredFields) {
    if (
      data[field] === undefined ||
      data[field] === null ||
      String(data[field]).trim() === ""
    ) {
      return `${field} is required.`;
    }
  }

  if (Number.isNaN(new Date(data.deadline).getTime())) {
    return "Please provide a valid application deadline.";
  }

  if (
    data.applicationUrl &&
    !/^https?:\/\/\S+$/i.test(data.applicationUrl)
  ) {
    return "Application URL must start with http:// or https://.";
  }

  if (
    data.applicationEmail &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.applicationEmail)
  ) {
    return "Please provide a valid application email.";
  }

  if (
    data.status !== undefined &&
    !["draft", "published", "closed"].includes(data.status)
  ) {
    return "Invalid job status.";
  }

  return null;
};

// ADMIN: Get all jobs
export const getAllJobs = async (req, res) => {
  try {
    const jobs = await Job.find()
      .populate("createdBy", "firstName lastName email")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: jobs.length,
      jobs,
    });
  } catch (error) {
    console.error("Get all jobs error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve jobs.",
    });
  }
};

// ADMIN: Create a job
export const createJob = async (req, res) => {
  try {
    const data = getJobData(req.body);
    const validationError = validateJobData(data);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const job = await Job.create({
  ...data,
  createdBy: req.user._id,
});

await createAuditLog({
  actor: req.user._id,
  action: "JOB_CREATED",
  resource: "Job",
  resourceId: job._id,
  details: {
    title: job.title,
    company: job.company,
    status: job.status,
  },
  req,
});

    return res.status(201).json({
      success: true,
      message: "Job created successfully.",
      job,
    });
  } catch (error) {
    console.error("Create job error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create job.",
    });
  }
};

// ADMIN: Update a job
// ADMIN: Update a job
export const updateJob = async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!isValidJobId(jobId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid job ID.",
      });
    }

    const job = await Job.findById(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found.",
      });
    }

    // Only accept fields explicitly provided by the client.
    const allowedFields = [
      "title",
      "company",
      "location",
      "employmentType",
      "description",
      "applicationUrl",
      "applicationEmail",
      "deadline",
      "status",
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided for update.",
      });
    }

    // Validate the complete job after merging the requested changes.
    const mergedData = {
      title: job.title,
      company: job.company,
      location: job.location,
      employmentType: job.employmentType,
      description: job.description,
      applicationUrl: job.applicationUrl || "",
      applicationEmail: job.applicationEmail || "",
      deadline: job.deadline,
      status: job.status,
      ...updates,
    };

    const validationError = validateJobData(mergedData);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

const changes = {};

for (const [field, newValue] of Object.entries(updates)) {
  const oldValue = job[field];

  const valuesDiffer =
    oldValue instanceof Date || newValue instanceof Date
      ? new Date(oldValue).getTime() !== new Date(newValue).getTime()
      : String(oldValue ?? "") !== String(newValue ?? "");

  if (valuesDiffer) {
    changes[field] = {
      from: oldValue ?? null,
      to: newValue ?? null,
    };
  }
}

if (Object.keys(changes).length === 0) {
  return res.status(400).json({
    success: false,
    message: "No changes detected.",
  });
}

Object.assign(job, updates);
await job.save();

await createAuditLog({
  actor: req.user._id,
  action: "JOB_UPDATED",
  resource: "Job",
  resourceId: job._id,
  details: {
    title: job.title,
    changes,
  },
  req,
});

    return res.status(200).json({
      success: true,
      message: "Job updated successfully.",
      job,
    });
  } catch (error) {
    console.error("Update job error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update job.",
    });
  }
};

// ADMIN: Delete a job
export const deleteJob = async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!isValidJobId(jobId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid job ID.",
      });
    }

   const job = await Job.findById(jobId);

if (!job) {
  return res.status(404).json({
    success: false,
    message: "Job not found.",
  });
}

await job.deleteOne();

await createAuditLog({
  actor: req.user._id,
  action: "JOB_DELETED",
  resource: "Job",
  resourceId: job._id,
  details: {
    title: job.title,
    company: job.company,
    status: job.status,
  },
  req,
});

    return res.status(200).json({
      success: true,
      message: "Job deleted successfully.",
    });
  } catch (error) {
    console.error("Delete job error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to delete job.",
    });
  }
};

// FINANCIAL MEMBERS: Get published, unexpired jobs
export const getAvailableJobs = async (req, res) => {
  try {
    const jobs = await Job.find({
      status: "published",
      deadline: { $gte: new Date() },
    })
      .select("-createdBy -__v")
      .sort({ deadline: 1, createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: jobs.length,
      jobs,
    });
  } catch (error) {
    console.error("Get available jobs error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve available jobs.",
    });
  }
};