const formatCurrency = (amount) => {
  return `₦${Number(amount || 0).toLocaleString("en-NG")}`;
};

const formatDate = (date) => {
  if (!date) return "Not specified";

  return new Date(date).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

export const buildObligationReminderEmail = ({
  firstName,
  obligationName,
  amountDue,
  amountPaid,
  outstanding,
  dueDate,
  reminderType,
  paymentUrl,
}) => {
  const reminderMessages = {
    thirtyDay: {
      eyebrow: "PAYMENT REMINDER",
      title: "Your payment is due in 30 days",
      message:
        "This is a friendly reminder that you have an outstanding payment obligation on your OlivetGOSA account.",
    },

    sevenDay: {
      eyebrow: "PAYMENT REMINDER",
      title: "Your payment is due in 7 days",
      message:
        "Your payment due date is approaching. Please review your obligation and make payment before the due date.",
    },

    oneDay: {
      eyebrow: "PAYMENT REMINDER",
      title: "Your payment is due tomorrow",
      message:
        "Your payment obligation is due tomorrow. Please complete your payment to keep your membership financial records up to date.",
    },

    due: {
      eyebrow: "PAYMENT DUE TODAY",
      title: "Your payment is due today",
      message:
        "Your payment obligation is due today. Please make payment if you have not already done so.",
    },

    overdue: {
      eyebrow: "OVERDUE PAYMENT",
      title: "Your payment is overdue",
      message:
        "Our records show that this payment obligation remains outstanding after its due date. Please make payment as soon as possible.",
    },
  };

  const content =
    reminderMessages[reminderType] || reminderMessages.overdue;

  const isOverdue = reminderType === "overdue";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  />

  <title>${content.title}</title>
</head>

<body
  style="
    margin:0;
    padding:0;
    background:#EAF1F8;
    font-family:Arial, Helvetica, sans-serif;
    color:#4B6075;
  "
>

  <div
    style="
      width:100%;
      padding:35px 15px;
      box-sizing:border-box;
      background:#EAF1F8;
    "
  >

    <div
      style="
        max-width:620px;
        margin:0 auto;
        background:#ffffff;
        border-radius:12px;
        overflow:hidden;
      "
    >

      <!-- HEADER -->
      <div
        style="
          background:#0B294D;
          padding:30px 35px;
          text-align:center;
        "
      >

        <img
          src="https://olivetbhsnosa.org/images/olivet-crest.png"
          alt="OlivetGOSA Crest"
          width="70"
          style="
            width:70px;
            height:auto;
            display:block;
            margin:0 auto 15px;
          "
        />

        <div
          style="
            color:#ffffff;
            font-size:25px;
            font-weight:700;
            line-height:1.2;
          "
        >
          OlivetGOSA
        </div>

        <div
          style="
            margin-top:7px;
            color:#C9A227;
            font-size:11px;
            font-weight:700;
            letter-spacing:2px;
            text-transform:uppercase;
          "
        >
          Global Old Students' Association
        </div>

      </div>

      <!-- GOLD DIVIDER -->
      <div
        style="
          height:4px;
          background:#C9A227;
        "
      ></div>

      <!-- CONTENT -->
      <div
        style="
          padding:40px 35px;
        "
      >

        <div
          style="
            color:#C9A227;
            font-size:11px;
            font-weight:700;
            letter-spacing:1.5px;
            text-transform:uppercase;
            margin-bottom:10px;
          "
        >
          ${content.eyebrow}
        </div>

        <h1
          style="
            margin:0 0 18px;
            color:#0B294D;
            font-size:28px;
            line-height:1.25;
            font-weight:700;
          "
        >
          ${content.title}
        </h1>

        <p
          style="
            margin:0 0 20px;
            color:#4B6075;
            font-size:15px;
            line-height:1.7;
          "
        >
          Dear ${firstName || "Member"},
        </p>

        <p
          style="
            margin:0 0 25px;
            color:#4B6075;
            font-size:15px;
            line-height:1.7;
          "
        >
          ${content.message}
        </p>

        <!-- PAYMENT INFORMATION -->
        <div
          style="
            background:#EAF1F8;
            border-left:4px solid #C9A227;
            padding:20px;
            margin:0 0 25px;
          "
        >

          <div
            style="
              color:#0B294D;
              font-size:16px;
              font-weight:700;
              margin-bottom:15px;
            "
          >
            Payment Details
          </div>

          <table
            width="100%"
            cellpadding="0"
            cellspacing="0"
            border="0"
            style="
              border-collapse:collapse;
              font-size:14px;
            "
          >

            <tr>
              <td
                style="
                  padding:7px 0;
                  color:#4B6075;
                "
              >
                Obligation
              </td>

              <td
                align="right"
                style="
                  padding:7px 0;
                  color:#0B294D;
                  font-weight:600;
                "
              >
                ${obligationName}
              </td>
            </tr>

            <tr>
              <td
                style="
                  padding:7px 0;
                  color:#4B6075;
                "
              >
                Amount Due
              </td>

              <td
                align="right"
                style="
                  padding:7px 0;
                  color:#0B294D;
                  font-weight:600;
                "
              >
                ${formatCurrency(amountDue)}
              </td>
            </tr>

            <tr>
              <td
                style="
                  padding:7px 0;
                  color:#4B6075;
                "
              >
                Amount Paid
              </td>

              <td
                align="right"
                style="
                  padding:7px 0;
                  color:#0B294D;
                  font-weight:600;
                "
              >
                ${formatCurrency(amountPaid)}
              </td>
            </tr>

            <tr>
              <td
                style="
                  padding:7px 0;
                  color:#4B6075;
                  font-weight:700;
                "
              >
                Outstanding
              </td>

              <td
                align="right"
                style="
                  padding:7px 0;
                  color:${isOverdue ? "#B42318" : "#0B294D"};
                  font-weight:700;
                "
              >
                ${formatCurrency(outstanding)}
              </td>
            </tr>

            <tr>
              <td
                style="
                  padding:7px 0;
                  color:#4B6075;
                "
              >
                Due Date
              </td>

              <td
                align="right"
                style="
                  padding:7px 0;
                  color:${isOverdue ? "#B42318" : "#0B294D"};
                  font-weight:600;
                "
              >
                ${formatDate(dueDate)}
              </td>
            </tr>

          </table>

        </div>

        <!-- CTA -->
        <div style="text-align:center; margin:30px 0;">

          <a
            href="${paymentUrl}"
            style="
              display:inline-block;
              background:#123B6D;
              color:#ffffff;
              text-decoration:none;
              padding:13px 24px;
              border-radius:7px;
              font-size:14px;
              font-weight:700;
            "
          >
            Review &amp; Make Payment
          </a>

        </div>

        <p
          style="
            margin:0;
            color:#4B6075;
            font-size:13px;
            line-height:1.7;
          "
        >
          You can also log in to your OlivetGOSA member portal to view your
          complete payment history, outstanding obligations and account
          information.
        </p>

      </div>

      <!-- FOOTER -->
      <div
        style="
          background:#0B294D;
          padding:25px 35px;
          text-align:center;
        "
      >

        <div
          style="
            color:#ffffff;
            font-size:15px;
            font-weight:700;
            margin-bottom:8px;
          "
        >
          OlivetGOSA
        </div>

        <div
          style="
            color:rgba(255,255,255,0.72);
            font-size:12px;
            line-height:1.6;
          "
        >
          Global Old Students' Association
        </div>

        <div
          style="
            margin-top:10px;
            color:#C9A227;
            font-size:11px;
            font-weight:700;
            letter-spacing:1.5px;
          "
        >
          CUM CHRISTO PROGREDERE
        </div>

        <div
          style="
            margin-top:18px;
            color:rgba(255,255,255,0.55);
            font-size:11px;
            line-height:1.6;
          "
        >
          This is an automated email from OlivetGOSA.
          <br />
          Please do not reply to this email.
        </div>

      </div>

    </div>

  </div>

</body>
</html>
`;
};