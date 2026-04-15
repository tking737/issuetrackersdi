import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server-auth";
import { listIssues } from "@/lib/firestore";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as XLSX from "xlsx";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);

    if (!user.isAdmin) {
      return NextResponse.json({ error: "Only admins can export." }, { status: 403 });
    }

    const url = new URL(request.url);
    const fileType = String(url.searchParams.get("type") || "excel").toLowerCase();
    const platform = String(url.searchParams.get("platform") || "All");
    const secondaryStatus = String(url.searchParams.get("secondaryStatus") || "All");
    const statusesParam = String(url.searchParams.get("statuses") || "");

    let issues = await listIssues();

    if (platform !== "All") {
      issues = issues.filter((issue) => issue.platform === platform);
    }

    if (secondaryStatus !== "All") {
      issues = issues.filter((issue) => issue.secondaryStatus === secondaryStatus);
    }

    const selectedStatuses = statusesParam
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    if (selectedStatuses.length) {
      issues = issues.filter((issue) => selectedStatuses.includes(issue.status));
    }

    const rows = issues.map((issue) => ({
      Title: issue.title,
      Platform: issue.platform,
      "Primary Status": issue.status,
      "Secondary Status": issue.secondaryStatus || "None",
      Owner: issue.owner || "",
      Priority: issue.priority,
      Category: issue.category,
      Submitter: issue.submitterName,
      "Submitter Email": issue.submitter,
      Description: issue.description,
      Votes: issue.votes,
      "Followers/Subscribers": issue.notifyOnResolve.join(", "),
      "Created At": issue.createdAt,
      "Resolved At": issue.resolvedAt || "",
      Comments: issue.comments.length,
      Attachments: issue.attachments.length,
    }));

    if (fileType === "excel") {
      const worksheet = XLSX.utils.json_to_sheet(
        rows.length
          ? rows
          : [
              {
                Message: "No issues matched the selected filters.",
                Platform: platform,
                Statuses: selectedStatuses.join(", ") || "None",
                "Secondary Status": secondaryStatus,
              },
            ]
      );

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Issues");
      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

      return new NextResponse(buffer, {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": 'attachment; filename="issues-export.xlsx"',
        },
      });
    }

    if (fileType === "pdf") {
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      let page = pdfDoc.addPage([612, 792]);
      let y = 760;

      const drawLine = (text: string, x: number, size = 10, bold = false) => {
        const activeFont = bold ? fontBold : font;
        page.drawText(text, {
          x,
          y,
          size,
          font: activeFont,
          color: rgb(0, 0, 0),
        });
        y -= size + 4;
      };

      drawLine("Issues Export", 40, 16, true);
      drawLine(`Platform Filter: ${platform}`, 40);
      drawLine(
        `Status Filter: ${selectedStatuses.length ? selectedStatuses.join(", ") : "All"}`,
        40
      );
      drawLine(`Secondary Status Filter: ${secondaryStatus}`, 40);
      y -= 8;

      if (!issues.length) {
        drawLine("No issues matched the selected filters.", 40, 12, true);
      } else {
        for (const issue of issues) {
          if (y < 120) {
            page = pdfDoc.addPage([612, 792]);
            y = 760;
          }

          drawLine(issue.title, 40, 12, true);
          drawLine(`Platform: ${issue.platform}`, 40);
          drawLine(`Primary Status: ${issue.status}`, 40);
          drawLine(`Secondary Status: ${issue.secondaryStatus || "None"}`, 40);
          drawLine(`Owner: ${issue.owner || "Unassigned"}`, 40);
          drawLine(`Priority: ${issue.priority}`, 40);
          drawLine(`Category: ${issue.category}`, 40);
          drawLine(`Submitter: ${issue.submitterName} (${issue.submitter})`, 40);
          drawLine(`Votes: ${issue.votes}`, 40);
          drawLine(`Followers: ${issue.notifyOnResolve.join(", ") || "None"}`, 40);

          const descriptionLines = issue.description
            ? issue.description.match(/.{1,95}/g) || []
            : [""];

          drawLine("Description:", 40, 10, true);
          for (const line of descriptionLines) {
            if (y < 120) {
              page = pdfDoc.addPage([612, 792]);
              y = 760;
            }
            drawLine(line, 60);
          }

          y -= 10;
        }
      }

      const pdfBytes = await pdfDoc.save();

      return new NextResponse(Buffer.from(pdfBytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'attachment; filename="issues-export.pdf"',
        },
      });
    }

    return NextResponse.json(
      { error: "Invalid export type. Use excel or pdf." },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Export failed." },
      { status: 500 }
    );
  }
}
