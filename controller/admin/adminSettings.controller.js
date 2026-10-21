import GeneralSettings from "../../models/GeneralSettings.js";
import { createAuditLog } from "../../services/auditLog.service.js";

const editableFields = [
  "associationName",
  "shortName",
  "contactEmail",
  "phone",
  "address",
  "website",
  "logoUrl",
];

const socialFields = [
  "facebook",
  "instagram",
  "youtube",
  "linkedin",
];

const getOrCreateSettings = async () => {
  let settings = await GeneralSettings.findOne({ key: "general" });

  if (!settings) {
    settings = await GeneralSettings.create({ key: "general" });
  }

  return settings;
};

const isValidUrl = (value) => {
  if (!value) return true;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const serializeSettings = (settings) => ({
  associationName: settings.associationName,
  shortName: settings.shortName,
  contactEmail: settings.contactEmail,
  phone: settings.phone,
  address: settings.address,
  website: settings.website,
  logoUrl: settings.logoUrl,
  socialLinks: {
    facebook: settings.socialLinks?.facebook || "",
    instagram: settings.socialLinks?.instagram || "",
    youtube: settings.socialLinks?.youtube || "",
    linkedin: settings.socialLinks?.linkedin || "",
  },
  updatedAt: settings.updatedAt,
});

export const getGeneralSettings = async (req, res) => {
  try {
    const settings = await getOrCreateSettings();

    return res.status(200).json({
      success: true,
      settings: serializeSettings(settings),
    });
  } catch (error) {
    console.error("Get general settings error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load general settings.",
    });
  }
};

export const updateGeneralSettings = async (req, res) => {
  try {
    const body = req.body || {};
    const settings = await getOrCreateSettings();
    const previousSettings = serializeSettings(settings);

    // Update only explicitly supported fields.
    for (const field of editableFields) {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        if (typeof body[field] !== "string") {
          return res.status(400).json({
            success: false,
            message: `${field} must be a string.`,
          });
        }

        settings[field] = body[field].trim();
      }
    }

    if (
      settings.contactEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.contactEmail)
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid contact email.",
      });
    }

    for (const field of ["website", "logoUrl"]) {
      if (!isValidUrl(settings[field])) {
        return res.status(400).json({
          success: false,
          message: `${field} must be a valid HTTP or HTTPS URL.`,
        });
      }
    }

    if (body.socialLinks !== undefined) {
      if (
        !body.socialLinks ||
        typeof body.socialLinks !== "object" ||
        Array.isArray(body.socialLinks)
      ) {
        return res.status(400).json({
          success: false,
          message: "Social links must be an object.",
        });
      }

      for (const field of socialFields) {
        if (
          Object.prototype.hasOwnProperty.call(body.socialLinks, field)
        ) {
          const value = body.socialLinks[field];

          if (typeof value !== "string") {
            return res.status(400).json({
              success: false,
              message: `The ${field} link must be a string.`,
            });
          }

          const trimmedValue = value.trim();

          if (!isValidUrl(trimmedValue)) {
            return res.status(400).json({
              success: false,
              message: `The ${field} link must be a valid HTTP or HTTPS URL.`,
            });
          }

          settings.socialLinks[field] = trimmedValue;
        }
      }
    }

    settings.updatedBy = req.user._id;
    await settings.save();

    const updatedSettings = serializeSettings(settings);

    await createAuditLog({
      actor: req.user._id,
      action: "GENERAL_SETTINGS_UPDATED",
      resource: "GeneralSettings",
      resourceId: settings._id,
      details: {
        changedFields: [
          ...editableFields.filter(
            (field) =>
              previousSettings[field] !== updatedSettings[field]
          ),
          ...(socialFields.some(
            (field) =>
              previousSettings.socialLinks[field] !==
              updatedSettings.socialLinks[field]
          )
            ? ["socialLinks"]
            : []),
        ],
      },
      req,
    });

    return res.status(200).json({
      success: true,
      message: "General settings saved successfully.",
      settings: updatedSettings,
    });
  } catch (error) {
    console.error("Update general settings error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to save general settings.",
    });
  }
};


export const getPublicGeneralSettings = async (req, res) => {
  try {
    const settings = await getOrCreateSettings();

    return res.status(200).json({
      success: true,
      settings: {
        associationName: settings.associationName,
        shortName: settings.shortName,
        contactEmail: settings.contactEmail,
        phone: settings.phone,
        address: settings.address,
        website: settings.website,
        logoUrl: settings.logoUrl,
        socialLinks: {
          facebook: settings.socialLinks?.facebook || "",
          instagram: settings.socialLinks?.instagram || "",
          youtube: settings.socialLinks?.youtube || "",
          linkedin: settings.socialLinks?.linkedin || "",
        },
      },
    });
  } catch (error) {
    console.error("Get public general settings error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load public settings.",
    });
  }
};