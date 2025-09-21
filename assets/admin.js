jQuery(document).ready(function ($) {
  "use strict";


   $('#update_questions').on('click', function(e) {
        e.preventDefault();
        var numQuestions = parseInt($('#number_of_questions').val(), 10) || 1;
        var $container = $('#questions-container .questions-grid');
        $container.empty();

        for (var i = 1; i <= numQuestions; i++) {
            var html = '<div class="question-item">';
            html += '<label>Q' + i + ':</label>';
            html += '<select name="correct_answers[' + i + ']">';
            html += '<option value="">Select</option>';
            html += '<option value="a">A</option>';
            html += '<option value="b">B</option>';
            html += '<option value="c">C</option>';
            html += '<option value="d">D</option>';
            html += '</select>';
            html += '</div>';
            $container.append(html);
        }
    });
    
    $('#update_answers').on('click', function(e) {
        e.preventDefault();
        var numQuestions = parseInt($('#number_of_questions').val(), 10) || 1;
        var numAnswers = parseInt($('#number_of_answers').val(), 10) || 4;
        var $container = $('#questions-container .questions-grid');
        $container.empty();

        for (var i = 1; i <= numQuestions; i++) {
            var html = '<div class="question-item">';
            html += '<label>Q' + i + ':</label>';
            html += '<select name="correct_answers[' + i + ']">';
            html += '<option value="">Select</option>';
            for (var j = 0; j < numAnswers; j++) {
                var option = String.fromCharCode(97 + j); // a, b, c, ...
                var optionLabel = option.toUpperCase();
                html += '<option value="' + option + '">' + optionLabel + '</option>';
            }
            html += '</select>';
            html += '</div>';
            $container.append(html);
        }
    });

  // PDF Upload functionality
  function initPDFUpload() {
    var mediaUploader;

    $("#upload_pdf_button").on("click", function (e) {
      e.preventDefault();

      // If the uploader object has already been created, reopen the dialog
      if (mediaUploader) {
        mediaUploader.open();
        return;
      }

      // Create the media uploader object
      mediaUploader = wp.media.frames.file_frame = wp.media({
        title: "Choose PDF File",
        button: {
          text: "Choose PDF",
        },
        library: {
          type: "application/pdf",
        },
        multiple: false,
      });

      // When a file is selected, grab the URL and set it as the text field's value
      mediaUploader.on("select", function () {
        var attachment = mediaUploader
          .state()
          .get("selection")
          .first()
          .toJSON();

        if (attachment.mime !== "application/pdf") {
          alert("Please select a PDF file.");
          return;
        }

        $("#pdf_url").val(attachment.url);
        showPreview(attachment.url, attachment.title);
      });

      // Open the uploader dialog
      mediaUploader.open();
    });
  }

  // Show PDF preview
  function showPreview(url, title) {
    var previewHtml = '<div class="pdf-preview" style="margin-top: 10px;">';
    previewHtml += "<strong>Selected PDF:</strong> " + title + "<br>";
    previewHtml += '<a href="' + url + '" target="_blank">View PDF</a> | ';
    previewHtml +=
      '<button type="button" id="remove-pdf" class="button">Remove</button>';
    previewHtml += "</div>";

    // Remove existing preview
    $(".pdf-preview").remove();

    // Add new preview
    $("#upload_pdf_button").after(previewHtml);

    // Remove PDF handler
    $("#remove-pdf").on("click", function () {
      $("#pdf_url").val("");
      $(".pdf-preview").remove();
    });
  }

  // Dynamic Questions Management
  function initQuestionsManagement() {
    $("#update_questions").on("click", function () {
      var numQuestions = parseInt($("#number_of_questions").val());

      if (!numQuestions || numQuestions < 1 || numQuestions > 200) {
        alert("Please enter a valid number of questions (1-200).");
        return;
      }

      updateQuestionsGrid(numQuestions);
    });

    // Initialize with current number of questions
    var currentNum = parseInt($("#number_of_questions").val()) || 50;
    updateQuestionsGrid(currentNum);
  }

  // Update questions grid
  function updateQuestionsGrid(numQuestions) {
    var container = $(".questions-grid");
    var existingAnswers = {};

    // Save existing answers
    container.find("select").each(function () {
      var name = $(this).attr("name");
      var match = name.match(/correct_answers\[(\d+)\]/);
      if (match) {
        existingAnswers[parseInt(match[1])] = $(this).val();
      }
    });

    // Clear container
    container.empty();

    // Generate new questions
    for (var i = 1; i <= numQuestions; i++) {
      var existingValue = existingAnswers[i] || "";

      var questionHtml = '<div class="question-item">';
      questionHtml += "<label>Q" + i + ":</label>";
      questionHtml += '<select name="correct_answers[' + i + ']">';
      questionHtml += '<option value="">Select</option>';
      questionHtml +=
        '<option value="a"' +
        (existingValue === "a" ? " selected" : "") +
        ">A</option>";
      questionHtml +=
        '<option value="b"' +
        (existingValue === "b" ? " selected" : "") +
        ">B</option>";
      questionHtml +=
        '<option value="c"' +
        (existingValue === "c" ? " selected" : "") +
        ">C</option>";
      questionHtml +=
        '<option value="d"' +
        (existingValue === "d" ? " selected" : "") +
        ">D</option>";
      questionHtml += "</select>";
      questionHtml += "</div>";

      container.append(questionHtml);
    }

    // Update visual feedback
    updateAnswerProgress();

    // Show success message
    showAdminNotification("Questions updated successfully!", "success");
  }

  // Update answer progress
  function updateAnswerProgress() {
    var totalQuestions = $(".question-item").length;
    var answeredQuestions = $(".question-item select").filter(function () {
      return $(this).val() !== "";
    }).length;

    // Create or update progress indicator
    var progressHtml = '<div class="answer-progress">';
    progressHtml +=
      "<p><strong>Answer Progress:</strong> " +
      answeredQuestions +
      "/" +
      totalQuestions +
      " questions have correct answers set</p>";
    progressHtml += '<div class="progress-bar-admin">';
    progressHtml +=
      '<div class="progress-fill-admin" style="width: ' +
      (totalQuestions > 0 ? (answeredQuestions / totalQuestions) * 100 : 0) +
      '%"></div>';
    progressHtml += "</div>";
    progressHtml += "</div>";

    $(".answer-progress").remove();
    $("#questions-container h3").after(progressHtml);

    // Update select change handlers
    $(".question-item select")
      .off("change.progress")
      .on("change.progress", function () {
        setTimeout(updateAnswerProgress, 100);
      });
  }

  // Bulk answer setting
  function initBulkAnswerSetting() {
    var bulkHtml =
      '<div class="bulk-answer-setting" style="margin: 20px 0; padding: 15px; background: #f9f9f9; border-radius: 4px;">';
    bulkHtml += "<h4>Bulk Answer Setting</h4>";
    bulkHtml += "<p>Set the same answer for a range of questions:</p>";
    bulkHtml +=
      '<label>From Question: <input type="number" id="bulk-from" min="1" style="width: 60px;"></label> ';
    bulkHtml +=
      '<label>To Question: <input type="number" id="bulk-to" min="1" style="width: 60px;"></label> ';
    bulkHtml += '<label>Answer: <select id="bulk-answer">';
    bulkHtml += '<option value="">Select</option>';
    bulkHtml += '<option value="a">A</option>';
    bulkHtml += '<option value="b">B</option>';
    bulkHtml += '<option value="c">C</option>';
    bulkHtml += '<option value="d">D</option>';
    bulkHtml += "</select></label> ";
    bulkHtml +=
      '<button type="button" id="apply-bulk" class="button">Apply</button>';
    bulkHtml += "</div>";

    $("#questions-container h3").after(bulkHtml);

    $("#apply-bulk").on("click", function () {
      var from = parseInt($("#bulk-from").val());
      var to = parseInt($("#bulk-to").val());
      var answer = $("#bulk-answer").val();

      if (!from || !to || !answer) {
        alert("Please fill in all bulk setting fields.");
        return;
      }

      if (from > to) {
        alert(
          "From question number must be less than or equal to To question number."
        );
        return;
      }

      var updated = 0;
      for (var i = from; i <= to; i++) {
        var select = $('select[name="correct_answers[' + i + ']"]');
        if (select.length) {
          select.val(answer);
          updated++;
        }
      }

      if (updated > 0) {
        showAdminNotification(
          "Updated " +
            updated +
            " questions with answer: " +
            answer.toUpperCase(),
          "success"
        );
        updateAnswerProgress();
      } else {
        showAdminNotification(
          "No questions found in the specified range.",
          "warning"
        );
      }
    });
  }

  // Answer pattern analysis
  function initAnswerAnalysis() {
    var analysisHtml = '<div class="answer-analysis" style="margin: 20px 0;">';
    analysisHtml +=
      '<button type="button" id="analyze-answers" class="button">Analyze Answer Pattern</button>';
    analysisHtml +=
      '<div id="analysis-results" style="margin-top: 10px;"></div>';
    analysisHtml += "</div>";

    $(".bulk-answer-setting").after(analysisHtml);

    $("#analyze-answers").on("click", function () {
      var analysis = {
        a: 0,
        b: 0,
        c: 0,
        d: 0,
        unanswered: 0,
      };
      var total = 0;

      $(".question-item select").each(function () {
        var value = $(this).val();
        total++;

        if (value) {
          analysis[value]++;
        } else {
          analysis.unanswered++;
        }
      });

      var resultsHtml =
        '<div style="background: white; padding: 15px; border-radius: 4px; border: 1px solid #ddd;">';
      resultsHtml += "<h4>Answer Distribution:</h4>";
      resultsHtml += "<ul>";
      resultsHtml +=
        "<li><strong>A:</strong> " +
        analysis.a +
        " (" +
        (total > 0 ? Math.round((analysis.a / total) * 100) : 0) +
        "%)</li>";
      resultsHtml +=
        "<li><strong>B:</strong> " +
        analysis.b +
        " (" +
        (total > 0 ? Math.round((analysis.b / total) * 100) : 0) +
        "%)</li>";
      resultsHtml +=
        "<li><strong>C:</strong> " +
        analysis.c +
        " (" +
        (total > 0 ? Math.round((analysis.c / total) * 100) : 0) +
        "%)</li>";
      resultsHtml +=
        "<li><strong>D:</strong> " +
        analysis.d +
        " (" +
        (total > 0 ? Math.round((analysis.d / total) * 100) : 0) +
        "%)</li>";
      resultsHtml +=
        "<li><strong>Unanswered:</strong> " +
        analysis.unanswered +
        " (" +
        (total > 0 ? Math.round((analysis.unanswered / total) * 100) : 0) +
        "%)</li>";
      resultsHtml += "</ul>";

      // Add recommendations
      if (analysis.unanswered > 0) {
        resultsHtml +=
          '<div style="color: #d63638; margin-top: 10px;"><strong>⚠️ Warning:</strong> ' +
          analysis.unanswered +
          " questions do not have correct answers set.</div>";
      }

      var maxAnswer = Object.keys(analysis).reduce((a, b) =>
        analysis[a] > analysis[b] ? a : b
      );
      if (maxAnswer !== "unanswered" && analysis[maxAnswer] > total * 0.5) {
        resultsHtml +=
          '<div style="color: #d63638; margin-top: 5px;"><strong>⚠️ Notice:</strong> Answer ' +
          maxAnswer.toUpperCase() +
          " appears to be used very frequently (" +
          Math.round((analysis[maxAnswer] / total) * 100) +
          "%). Consider reviewing for balance.</div>";
      }

      resultsHtml += "</div>";

      $("#analysis-results").html(resultsHtml);
    });
  }

  // Import/Export functionality
  function initImportExport() {
    var importExportHtml =
      '<div class="import-export-section" style="margin: 20px 0; padding: 15px; background: #f0f0f1; border-radius: 4px;">';
    importExportHtml += "<h4>Import/Export Answers</h4>";
    importExportHtml += "<p>";
    importExportHtml +=
      '<button type="button" id="export-answers" class="button">Export Answers</button> ';
    importExportHtml +=
      '<input type="file" id="import-file" accept=".json" style="display: none;"> ';
    importExportHtml +=
      '<button type="button" id="import-answers" class="button">Import Answers</button>';
    importExportHtml += "</p>";
    importExportHtml +=
      '<p class="description">Export answers to JSON file or import from a previously exported file.</p>';
    importExportHtml += "</div>";

    $(".answer-analysis").after(importExportHtml);

    // Export functionality
    $("#export-answers").on("click", function () {
      var answers = {};
      var postTitle = $("#title").val() || "quiz-answers";

      $(".question-item select").each(function () {
        var name = $(this).attr("name");
        var match = name.match(/correct_answers\[(\d+)\]/);
        if (match && $(this).val()) {
          answers[match[1]] = $(this).val();
        }
      });

      var exportData = {
        quiz_title: postTitle,
        total_questions: parseInt($("#number_of_questions").val()),
        answers: answers,
        export_date: new Date().toISOString(),
      };

      var dataStr = JSON.stringify(exportData, null, 2);
      var dataUri =
        "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);

      var exportFileDefaultName =
        postTitle.replace(/[^a-z0-9]/gi, "-").toLowerCase() + "-answers.json";

      var linkElement = document.createElement("a");
      linkElement.setAttribute("href", dataUri);
      linkElement.setAttribute("download", exportFileDefaultName);
      linkElement.click();

      showAdminNotification("Answers exported successfully!", "success");
    });

    // Import functionality
    $("#import-answers").on("click", function () {
      $("#import-file").click();
    });

    $("#import-file").on("change", function (e) {
      var file = e.target.files[0];
      if (!file) return;

      var reader = new FileReader();
      reader.onload = function (e) {
        try {
          var importData = JSON.parse(e.target.result);

          if (!importData.answers) {
            throw new Error("Invalid file format");
          }

          // Update number of questions if different
          if (
            importData.total_questions &&
            importData.total_questions !==
              parseInt($("#number_of_questions").val())
          ) {
            if (
              confirm(
                "The imported file has " +
                  importData.total_questions +
                  " questions, but current quiz has " +
                  $("#number_of_questions").val() +
                  ". Update the number of questions?"
              )
            ) {
              $("#number_of_questions").val(importData.total_questions);
              updateQuestionsGrid(importData.total_questions);
            }
          }

          // Import answers
          var imported = 0;
          Object.keys(importData.answers).forEach(function (questionNum) {
            var select = $(
              'select[name="correct_answers[' + questionNum + ']"]'
            );
            if (select.length) {
              select.val(importData.answers[questionNum]);
              imported++;
            }
          });

          updateAnswerProgress();
          showAdminNotification(
            "Imported " + imported + " answers successfully!",
            "success"
          );
        } catch (error) {
          alert("Error importing file: " + error.message);
        }
      };
      reader.readAsText(file);
    });
  }

  // Show admin notification
  function showAdminNotification(message, type) {
    type = type || "info";

    var noticeClass = "notice notice-" + type;
    if (type === "success") noticeClass = "notice notice-success";
    else if (type === "warning") noticeClass = "notice notice-warning";
    else if (type === "error") noticeClass = "notice notice-error";

    var notice = $(
      '<div class="' +
        noticeClass +
        ' is-dismissible"><p>' +
        message +
        "</p></div>"
    );

    $(".wrap h1").after(notice);

    // Auto-remove after 5 seconds
    setTimeout(function () {
      notice.fadeOut(300, function () {
        $(this).remove();
      });
    }, 5000);
  }

  // Form validation
  function initFormValidation() {
    $("form#post").on("submit", function (e) {
      var pdfUrl = $("#pdf_url").val();
      var numQuestions = parseInt($("#number_of_questions").val());

      if (!pdfUrl) {
        alert("Please upload a PDF file before saving.");
        e.preventDefault();
        return false;
      }

      if (!numQuestions || numQuestions < 1) {
        alert("Please enter a valid number of questions.");
        e.preventDefault();
        return false;
      }

      // Check if at least some questions have answers
      var answeredCount = $(".question-item select").filter(function () {
        return $(this).val() !== "";
      }).length;

      if (answeredCount === 0) {
        if (
          !confirm(
            "No correct answers have been set for any questions. Are you sure you want to save?"
          )
        ) {
          e.preventDefault();
          return false;
        }
      } else if (answeredCount < numQuestions) {
        if (
          !confirm(
            "Only " +
              answeredCount +
              " out of " +
              numQuestions +
              " questions have correct answers set. Continue saving?"
          )
        ) {
          e.preventDefault();
          return false;
        }
      }
    });
  }

  // Initialize all admin functionality
  function initialize() {
    initPDFUpload();
    initQuestionsManagement();
    initBulkAnswerSetting();
    initAnswerAnalysis();
    initImportExport();
    initFormValidation();

    // Show initial PDF preview if URL exists
    var existingPdfUrl = $("#pdf_url").val();
    if (existingPdfUrl) {
      var filename = existingPdfUrl.split("/").pop();
      showPreview(existingPdfUrl, filename);
    }
  }

  // Start initialization
  initialize();
});