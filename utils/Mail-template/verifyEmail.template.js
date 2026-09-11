const verifyEmailTemplate = ({ firstName, verificationUrl }) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify your OlivetNOSA email</title>
</head>

<body style="
  margin:0;
  padding:0;
  background:#f4f7fa;
  font-family:Arial, Helvetica, sans-serif;
  color:#26364a;
">

  <table
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
    style="background:#f4f7fa; padding:40px 15px;"
  >
    <tr>
      <td align="center">

        <!-- EMAIL CONTAINER -->
        <table
          width="100%"
          cellpadding="0"
          cellspacing="0"
          border="0"
          style="
            max-width:620px;
            background:#ffffff;
            border:1px solid #e3e8ee;
            border-radius:10px;
            overflow:hidden;
          "
        >

          <!-- HEADER -->
          <tr>
            <td style="
              padding:28px 35px;
              border-bottom:1px solid #edf0f3;
            ">

              <div style="
                font-size:20px;
                font-weight:bold;
                color:#123B6D;
                letter-spacing:0.5px;
              ">
                OLIVETNOSA
              </div>

              <div style="
                margin-top:5px;
                font-size:12px;
                line-height:1.5;
                color:#718096;
              ">
                Olivet Baptist High School
                <br />
                Global Old Students Association
              </div>

            </td>
          </tr>


          <!-- CONTENT -->
          <tr>
            <td style="padding:42px 35px 35px;">

              <p style="
                margin:0 0 18px;
                font-size:16px;
                color:#26364a;
              ">
                Hello ${firstName},
              </p>


              <p style="
                margin:0 0 18px;
                font-size:15px;
                line-height:1.7;
                color:#4a5568;
              ">
                Thank you for registering with OlivetNOSA.
              </p>


              <p style="
                margin:0 0 25px;
                font-size:15px;
                line-height:1.7;
                color:#4a5568;
              ">
                We're glad to have you take this step toward reconnecting
                with the Olivet family.
              </p>


              <p style="
                margin:0 0 25px;
                font-size:15px;
                line-height:1.7;
                color:#4a5568;
              ">
                Before we can continue with your registration, we just need
                to confirm that this email address belongs to you.
              </p>


              <!-- BUTTON -->
              <table
                cellpadding="0"
                cellspacing="0"
                border="0"
                style="margin:30px 0;"
              >
                <tr>
                  <td
                    align="center"
                    bgcolor="#123B6D"
                    style="border-radius:6px;"
                  >

                    <a
                      href="${verificationUrl}"
                      target="_blank"
                      style="
                        display:inline-block;
                        padding:14px 26px;
                        font-size:14px;
                        font-weight:bold;
                        color:#ffffff;
                        text-decoration:none;
                        border-radius:6px;
                      "
                    >
                      Verify My Email
                    </a>

                  </td>
                </tr>
              </table>


              <!-- EXPIRY -->
              <p style="
                margin:0 0 15px;
                font-size:14px;
                line-height:1.6;
                color:#718096;
              ">
                This verification link will expire in
                <strong>30 minutes</strong>.
              </p>


              <!-- SECURITY NOTE -->
              <p style="
                margin:25px 0 0;
                font-size:13px;
                line-height:1.6;
                color:#718096;
              ">
                If you didn't create an OlivetNOSA account, you can safely
                ignore this email. No changes will be made to your account.
              </p>

            </td>
          </tr>


          <!-- FOOTER -->
          <tr>
            <td style="
              padding:25px 35px;
              background:#f8fafc;
              border-top:1px solid #edf0f3;
            ">

              <p style="
                margin:0 0 8px;
                font-size:13px;
                color:#526174;
              ">
                Warm regards,
              </p>

              <p style="
                margin:0 0 20px;
                font-size:13px;
                font-weight:bold;
                line-height:1.5;
                color:#123B6D;
              ">
                OlivetNOSA
                <br />
                Global Old Students Association
              </p>

              <p style="
                margin:0;
                font-size:11px;
                line-height:1.6;
                color:#8a96a3;
              ">
                Olivet Baptist High School, Olivet Heights, Oyo, Nigeria
                <br />
                This is an automated email. Please do not reply directly
                to this message.
              </p>

            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>
`;
};

export default verifyEmailTemplate;