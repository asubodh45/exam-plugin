//frontend.js

jQuery(document).ready(function ($) {
  "use strict";

  // PDF.js variables (only if PDF.js is being used)
  let pdfDoc = null;
  let pageNum = 1;
  let pageRendering = false;
  let pageNumPending = null;
  let scale = 0.8;

  // Quiz timing variables
  let quizStartTime = null;
  let timerInterval = null;
  let examTimeInMinutes = 0;

  // Initialize PDF viewer if canvas exists
  function initPDFViewer() {
    const canvas = document.getElementById("pdf-canvas");
    if (!canvas) return; // Skip if using iframe approach

    const ctx = canvas.getContext("2d");
    const loadingDiv = document.getElementById("pdf-loading");
    const pdfUrl =
      canvas.getAttribute("data-pdf-url") ||
      $(".pdf-mcq-container").attr("data-pdf-url");

    if (!pdfUrl) {
      console.error("PDF URL not found");
      return;
    }

    // PDF.js configuration
    if (typeof pdfjsLib !== "undefined") {
      pdfjsLib.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

      // Load PDF
      pdfjsLib
        .getDocument(pdfUrl)
        .promise.then(function (pdfDoc_) {
          pdfDoc = pdfDoc_;
          document.getElementById("page-count").textContent = pdfDoc.numPages;

          if (loadingDiv) loadingDiv.style.display = "none";
          canvas.style.display = "block";

          // Render the first page
          renderPage(pageNum);

          // Auto fit width after loading
          setTimeout(fitWidth, 500);
        })
        .catch(function (error) {
          console.error("Error loading PDF:", error);
          if (loadingDiv) {
            loadingDiv.innerHTML =
              'Error loading PDF. <a href="' +
              pdfUrl +
              '" target="_blank">Open PDF directly</a>';
          }
        });
    }
  }

  // Render specific page
  function renderPage(num) {
    if (!pdfDoc) return;

    pageRendering = true;

    pdfDoc.getPage(num).then(function (page) {
      const canvas = document.getElementById("pdf-canvas");
      const ctx = canvas.getContext("2d");
      const viewport = page.getViewport({ scale: scale });

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: ctx,
        viewport: viewport,
      };

      const renderTask = page.render(renderContext);

      renderTask.promise.then(function () {
        pageRendering = false;
        if (pageNumPending !== null) {
          renderPage(pageNumPending);
          pageNumPending = null;
        }
      });
    });

    const pageNumElement = document.getElementById("page-num");
    if (pageNumElement) {
      pageNumElement.textContent = num;
    }
  }

  // Queue rendering
  function queueRenderPage(num) {
    if (pageRendering) {
      pageNumPending = num;
    } else {
      renderPage(num);
    }
  }

  // PDF Navigation functions
  function onPrevPage() {
    if (pageNum <= 1) return;
    pageNum--;
    queueRenderPage(pageNum);
  }

  function onNextPage() {
    if (pageNum >= pdfDoc.numPages) return;
    pageNum++;
    queueRenderPage(pageNum);
  }

  function zoomIn() {
    scale *= 1.2;
    queueRenderPage(pageNum);
  }

  function zoomOut() {
    scale /= 1.2;
    queueRenderPage(pageNum);
  }

  function fitWidth() {
    if (pdfDoc) {
      pdfDoc.getPage(pageNum).then(function (page) {
        const canvas = document.getElementById("pdf-canvas");
        const containerWidth = canvas.parentElement.clientWidth - 40;
        const viewport = page.getViewport({ scale: 1 });
        scale = (containerWidth / viewport.width) * 0.8; // Multiply by 0.8 for 20% less
        queueRenderPage(pageNum);
      });
    }
  }

  // Initialize PDF controls
  function initPDFControls() {
    $("#prev-page").on("click", onPrevPage);
    $("#next-page").on("click", onNextPage);
    $("#zoom-in").on("click", zoomIn);
    $("#zoom-out").on("click", zoomOut);
    $("#fit-width").on("click", fitWidth);
  }

  // Enhanced Quiz initialization
  function initQuiz() {
    // Handle start quiz button (NEW)
    $("#start-quiz").on("click", function () {
      const studentName = $("#student-name").val().trim();

      if (!studentName) {
        alert("Please enter your name to start the quiz.");
        return;
      }

      // Hide user info section and show quiz content
      $("#user-info-section").hide();
      $(".pdf-mcq-content").show();

      // Start enhanced timer
      startEnhancedExamTimer();

      // Load PDF
      initPDFViewer();

      // Record start time
      quizStartTime = new Date();

      // Load any auto-saved answers
      loadAutoSave();

      // Initialize progress tracking
      updateProgress();
    });

    // Add event listeners for radio buttons
    $('.mcq-question input[type="radio"]').on("change", function () {
      var questionDiv = $(this).closest(".mcq-question");
      questionDiv.addClass("answered");

      // Update the visual state
      updateQuestionState(questionDiv);

      // Update progress and navigation
      setTimeout(function () {
        updateProgress();
        updateNavigationStates();
      }, 100);
    });

    // Submit quiz button (ENHANCED)
    $("#submit-quiz").on("click", function () {
      if (confirm("Are you sure you want to submit your quiz?")) {
        submitEnhancedQuiz();
      }
    });

    // Reset quiz button (keeping existing functionality)
    $("#reset-quiz").on("click", function () {
      resetQuiz();
    });

    // Auto-save functionality (optional)
    setInterval(autoSave, 30000); // Auto-save every 30 seconds
  }

  // Enhanced exam timer with warnings
  function startEnhancedExamTimer() {
    const timerElement = $(".exam-timer");
    examTimeInMinutes = parseInt(timerElement.data("time"), 10) || 30;
    let timeLeft = examTimeInMinutes * 60; // Convert to seconds

    // Clear any existing timer
    if (timerInterval) {
      clearInterval(timerInterval);
    }

    timerInterval = setInterval(function () {
      const hours = Math.floor(timeLeft / 3600);
      const minutes = Math.floor((timeLeft % 3600) / 60);
      const seconds = timeLeft % 60;

      let displayTime = "";
      if (hours > 0) {
        displayTime = `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
          .toString()
          .padStart(2, "0")}`;
      } else {
        displayTime = `${minutes}:${seconds.toString().padStart(2, "0")}`;
      }

      $("#timer-display").text(displayTime);

      // Warning when 5 minutes left
      if (timeLeft === 300) {
        timerElement.css({
          background: "linear-gradient(135deg, #ffebee, #ffcdd2)",
          "border-color": "#f44336",
          color: "#c62828",
        });
        showNotification("⚠️ Warning: Only 5 minutes remaining!", "warning");
      }

      // Warning when 1 minute left
      if (timeLeft === 60) {
        timerElement.css({
          background: "linear-gradient(135deg, #ffcdd2, #ef9a9a)",
          "border-color": "#d32f2f",
          color: "#b71c1c",
        });
        showNotification("⚠️ Final Warning: Only 1 minute remaining!", "error");
      }

      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        showNotification(
          "⏰ Time's up! Your quiz will be submitted automatically.",
          "error"
        );
        setTimeout(() => submitEnhancedQuiz(), 2000);
        return;
      }

      timeLeft--;
    }, 1000);
  }

  // Enhanced quiz submission with user data
  function submitEnhancedQuiz() {
    // Clear timer
    if (timerInterval) {
      clearInterval(timerInterval);
    }

    var submitButton = $("#submit-quiz");
    var originalText = submitButton.text();

    // Disable button and show loading state
    submitButton.prop("disabled", true).text("Submitting...");

    // Calculate time taken
    const endTime = new Date();
    const timeTakenSeconds = quizStartTime
      ? Math.floor((endTime - quizStartTime) / 1000)
      : 0;

    // Collect answers
    const answers = {};
    $(".mcq-question").each(function () {
      const questionNum = $(this).data("question");
      const selectedAnswer = $(this).find('input[type="radio"]:checked').val();
      if (selectedAnswer) {
        answers[questionNum] = selectedAnswer;
      }
    });

    // Get user info
    const userName = $("#student-name").val().trim() || "Guest";
    const userEmail = $("#student-email").val().trim() || "";

    // Get quiz data
    const container = $(".pdf-mcq-container");
    const quizId = container.data("quiz-id");

    if (Object.keys(answers).length === 0) {
      alert("Please answer at least one question before submitting.");
      submitButton.prop("disabled", false).text(originalText);
      return;
    }

    // AJAX request to submit answers (ENHANCED)
    $.ajax({
      url: pdf_mcq_ajax.ajax_url,
      type: "POST",
      data: {
        action: "save_quiz_answers",
        nonce: pdf_mcq_ajax.nonce,
        quiz_id: quizId,
        answers: answers,
        user_name: userName,
        user_email: userEmail,
        time_taken: timeTakenSeconds,
      },
      success: function (response) {
        if (response.success) {
          displayEnhancedResults(response.data);
          disableQuiz();
          clearAutoSave(); // Clear auto-saved data after successful submission
        } else {
          alert("Error submitting quiz: " + (response.data || "Unknown error"));
        }
      },
      error: function (xhr, status, error) {
        alert("Error submitting quiz. Please try again.");
        console.error("AJAX Error:", error);
      },
      complete: function () {
        submitButton.prop("disabled", false).text(originalText);
      },
    });
  }

  // Enhanced results display with detailed marking
  function displayEnhancedResults(data) {
    $(".pdf-mcq-content").hide();
    $("#quiz-results").show();

    const timeTakenMinutes = Math.floor(data.time_taken / 60);
    const timeTakenSeconds = data.time_taken % 60;
    const timeDisplay = `${timeTakenMinutes}:${timeTakenSeconds
      .toString()
      .padStart(2, "0")}`;

    let resultHtml = `
      <div class="result-summary" style="background: #fff; padding: 20px; border: 1px solid #ddd; border-radius: 5px; margin-bottom: 20px;">
        <h3>Quiz Summary</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 15px 0;">
          <div style="text-align: center; padding: 15px; background: #e8f5e8; border-radius: 5px;">
            <div style="font-size: 24px; font-weight: bold; color: #2e7d32;">${data.correct_count}</div>
            <div style="color: #4caf50;">Correct</div>
          </div>
          <div style="text-align: center; padding: 15px; background: #fce8e8; border-radius: 5px;">
            <div style="font-size: 24px; font-weight: bold; color: #c62828;">${data.incorrect_count}</div>
            <div style="color: #f44336;">Incorrect</div>
          </div>
          <div style="text-align: center; padding: 15px; background: #fff3cd; border-radius: 5px;">
            <div style="font-size: 24px; font-weight: bold; color: #f57f17;">${data.unanswered_count}</div>
            <div style="color: #ff9800;">Unanswered</div>
          </div>
          <div style="text-align: center; padding: 15px; background: #e3f2fd; border-radius: 5px;">
            <div style="font-size: 24px; font-weight: bold; color: #1565c0;">${data.percentage}%</div>
            <div style="color: #2196f3;">Score</div>
          </div>
        </div>
        <table style="width: 100%; margin-top: 15px;">
          <tr><th style="text-align: left; padding: 5px;">Total Questions:</th><td style="padding: 5px;">${data.total_questions}</td></tr>
          <tr><th style="text-align: left; padding: 5px;">Positive Marks:</th><td style="padding: 5px; color: green;">+${data.positive_marks}</td></tr>
          <tr><th style="text-align: left; padding: 5px;">Negative Marks:</th><td style="padding: 5px; color: red;">-${data.negative_marks}</td></tr>
          <tr><th style="text-align: left; padding: 5px;">Total Marks:</th><td style="padding: 5px; font-weight: bold;">${data.total_marks}/${data.max_possible_marks}</td></tr>
          <tr><th style="text-align: left; padding: 5px;">Time Taken:</th><td style="padding: 5px;">${timeDisplay}</td></tr>
        </table>
      </div>
    `;

    // Question-wise results
    resultHtml += `
      <div class="question-wise-results" style="background: #fff; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
        <h3>Question-wise Results</h3>
        <div style="max-height: 400px; overflow-y: auto;">
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #f5f5f5;">
                <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Q#</th>
                <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Your Answer</th>
                <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Correct Answer</th>
                <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Result</th>
              </tr>
            </thead>
            <tbody>
    `;

    // Add each question result
    Object.keys(data.results).forEach(function (questionNum) {
      const result = data.results[questionNum];
      const userAnswer = result.user_answer
        ? result.user_answer.toUpperCase()
        : "Not Answered";
      const correctAnswer = result.correct_answer
        ? result.correct_answer.toUpperCase()
        : "Not Set";

      let resultText, resultColor, bgColor;
      if (result.is_unanswered) {
        resultText = "Unanswered";
        resultColor = "#ff9800";
        bgColor = "#fff3cd";
      } else if (result.is_correct) {
        resultText = "✓ Correct";
        resultColor = "#4caf50";
        bgColor = "#e8f5e8";
      } else {
        resultText = "✗ Incorrect";
        resultColor = "#f44336";
        bgColor = "#fce8e8";
      }

      resultHtml += `
        <tr style="background: ${bgColor};">
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: bold;">${questionNum}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${userAnswer}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${correctAnswer}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center; color: ${resultColor}; font-weight: bold;">${resultText}</td>
        </tr>
      `;
    });

    resultHtml += `
            </tbody>
          </table>
        </div>
        <div style="margin-top: 20px; text-align: center;">
          <button type="button" onclick="window.print()" class="button">Print Results</button>
          <button type="button" onclick="location.reload()" class="button button-primary">Take Quiz Again</button>
        </div>
      </div>
    `;

    $("#results-content").html(resultHtml);

    // Update question visual states and navigation
    Object.keys(data.results).forEach(function (questionNum) {
      const result = data.results[questionNum];
      const questionDiv = $(`.mcq-question[data-question="${questionNum}"]`);

      questionDiv
        .removeClass("answered")
        .addClass(
          result.is_unanswered
            ? "unanswered"
            : result.is_correct
            ? "correct"
            : "incorrect"
        );
    });

    // Update navigation states
    updateNavigationStates();

    // Scroll to results
    $("html, body").animate(
      {
        scrollTop: $("#quiz-results").offset().top,
      },
      500
    );
  }

  // Update question visual state
  function updateQuestionState(questionDiv) {
    var hasAnswer = questionDiv.find('input[type="radio"]:checked').length > 0;

    if (hasAnswer) {
      questionDiv.addClass("answered");
    } else {
      questionDiv.removeClass("answered");
    }
  }

  // Disable quiz after submission
  function disableQuiz() {
    $('.mcq-question input[type="radio"]').prop("disabled", true);
    $("#submit-quiz").prop("disabled", true).text("Quiz Submitted");
    $("#reset-quiz").prop("disabled", true);
    $(".mcq-section").addClass("loading");
  }

  // Reset quiz (keeping existing functionality but enhanced)
  function resetQuiz() {
    if (!confirm("Are you sure you want to reset all your answers?")) {
      return;
    }

    // Clear all selections
    $('.mcq-question input[type="radio"]')
      .prop("checked", false)
      .prop("disabled", false);

    // Reset visual states
    $(".mcq-question").removeClass("answered correct incorrect");
    $(".mcq-section").removeClass("loading");

    // Reset buttons
    $("#submit-quiz").prop("disabled", false).text("Submit Quiz");
    $("#reset-quiz").prop("disabled", false);

    // Hide results
    $("#quiz-results").hide().removeClass("fade-in");

    // Clear any auto-saved data
    clearAutoSave();

    // Update progress and navigation
    updateProgress();
    updateNavigationStates();
  }

  // Auto-save functionality (keeping existing)
  function autoSave() {
    var quizContainer = $(".pdf-mcq-container");
    var quizId = quizContainer.data("quiz-id");

    if (!quizId) return;

    const answers = {};
    $(".mcq-question").each(function () {
      const questionNum = $(this).data("question");
      const selectedAnswer = $(this).find('input[type="radio"]:checked').val();
      if (selectedAnswer) {
        answers[questionNum] = selectedAnswer;
      }
    });

    if (Object.keys(answers).length > 0) {
      localStorage.setItem("pdf_mcq_quiz_" + quizId, JSON.stringify(answers));
    }
  }

  // Load auto-saved data (keeping existing)
  function loadAutoSave() {
    var quizContainer = $(".pdf-mcq-container");
    var quizId = quizContainer.data("quiz-id");

    if (quizId) {
      var savedData = localStorage.getItem("pdf_mcq_quiz_" + quizId);
      if (savedData) {
        try {
          var answers = JSON.parse(savedData);

          // Restore saved answers
          $.each(answers, function (questionNum, answer) {
            var questionDiv = $(
              '.mcq-question[data-question="' + questionNum + '"]'
            );
            var radioInput = questionDiv.find('input[value="' + answer + '"]');

            if (radioInput.length) {
              radioInput.prop("checked", true);
              updateQuestionState(questionDiv);
            }
          });

          // Show notification about restored data
          showNotification("Your previous answers have been restored.", "info");
        } catch (e) {
          console.error("Error loading auto-saved data:", e);
        }
      }
    }
  }

  // Clear auto-saved data (keeping existing)
  function clearAutoSave() {
    var quizContainer = $(".pdf-mcq-container");
    var quizId = quizContainer.data("quiz-id");

    if (quizId) {
      localStorage.removeItem("pdf_mcq_quiz_" + quizId);
    }
  }

  // Show notification (enhanced)
  function showNotification(message, type) {
    type = type || "info";

    var notification = $(
      '<div class="quiz-notification ' + type + '">' + message + "</div>"
    );

    // Add notification styles if not already added
    if (!$("#quiz-notification-styles").length) {
      $("head").append(
        '<style id="quiz-notification-styles">' +
          ".quiz-notification {" +
          "position: fixed;" +
          "top: 20px;" +
          "right: 20px;" +
          "padding: 15px 20px;" +
          "border-radius: 4px;" +
          "color: white;" +
          "font-weight: bold;" +
          "z-index: 9999;" +
          "max-width: 300px;" +
          "box-shadow: 0 4px 8px rgba(0,0,0,0.2);" +
          "animation: slideInRight 0.3s ease-out;" +
          "}" +
          ".quiz-notification.info { background-color: #0073aa; }" +
          ".quiz-notification.success { background-color: #46b450; }" +
          ".quiz-notification.warning { background-color: #ffb900; }" +
          ".quiz-notification.error { background-color: #dc3232; }" +
          "@keyframes slideInRight {" +
          "from { transform: translateX(100%); opacity: 0; }" +
          "to { transform: translateX(0); opacity: 1; }" +
          "}" +
          "</style>"
      );
    }

    $("body").append(notification);

    // Auto-remove after 5 seconds
    setTimeout(function () {
      notification.fadeOut(300, function () {
        $(this).remove();
      });
    }, 5000);
  }

  // Progress tracking (enhanced)
  function updateProgress() {
    var totalQuestions = $(".mcq-question").length;
    var answeredQuestions = $(".mcq-question.answered").length;
    var percentage =
      totalQuestions > 0
        ? Math.round((answeredQuestions / totalQuestions) * 100)
        : 0;

    // Update or create progress bar
    var progressBar = $(".quiz-progress");
    if (progressBar.length === 0) {
      progressBar = $(
        '<div class="quiz-progress"><div class="progress-bar"><div class="progress-fill"></div></div><div class="progress-text"></div></div>'
      );
      $(".mcq-header").append(progressBar);

      // Add progress bar styles
      if (!$("#quiz-progress-styles").length) {
        $("head").append(
          '<style id="quiz-progress-styles">' +
            ".quiz-progress {" +
            "margin-left: 20px;" +
            "text-align: center;" +
            "}" +
            ".progress-bar {" +
            "width: 200px;" +
            "height: 20px;" +
            "background-color: #e0e0e0;" +
            "border-radius: 10px;" +
            "overflow: hidden;" +
            "margin-bottom: 5px;" +
            "}" +
            ".progress-fill {" +
            "height: 100%;" +
            "background-color: #0073aa;" +
            "transition: width 0.3s ease;" +
            "border-radius: 10px;" +
            "}" +
            ".progress-text {" +
            "font-size: 12px;" +
            "color: #666;" +
            "}" +
            "</style>"
        );
      }
    }

    progressBar.find(".progress-fill").css("width", percentage + "%");
    progressBar
      .find(".progress-text")
      .text(
        answeredQuestions + "/" + totalQuestions + " (" + percentage + "%)"
      );
  }

  // Keyboard shortcuts (keeping existing)
  function initKeyboardShortcuts() {
    $(document).on("keydown", function (e) {
      // Only activate shortcuts when quiz is active
      if (!$(".pdf-mcq-content").is(":visible")) {
        return;
      }

      // Ctrl/Cmd + Enter to submit
      if ((e.ctrlKey || e.metaKey) && e.keyCode === 13) {
        e.preventDefault();
        $("#submit-quiz").click();
      }

      // Ctrl/Cmd + R to reset (prevent default browser refresh)
      if ((e.ctrlKey || e.metaKey) && e.keyCode === 82) {
        e.preventDefault();
        $("#reset-quiz").click();
      }

      // PDF navigation shortcuts (only if PDF canvas exists)
      if (document.getElementById("pdf-canvas")) {
        // Arrow keys for PDF navigation
        if (e.keyCode === 37 || e.keyCode === 38) {
          // Left or Up arrow
          e.preventDefault();
          onPrevPage();
        } else if (e.keyCode === 39 || e.keyCode === 40) {
          // Right or Down arrow
          e.preventDefault();
          onNextPage();
        }

        // Zoom shortcuts
        if (e.ctrlKey || e.metaKey) {
          if (e.keyCode === 187 || e.keyCode === 107) {
            // + key
            e.preventDefault();
            zoomIn();
          } else if (e.keyCode === 189 || e.keyCode === 109) {
            // - key
            e.preventDefault();
            zoomOut();
          } else if (e.keyCode === 48) {
            // 0 key
            e.preventDefault();
            fitWidth();
          }
        }
      }
    });
  }

  // Question navigation (keeping existing)
  function initQuestionNavigation() {
    // Add question number links for easy navigation
    var navigationHtml = '<div class="question-navigation">';
    navigationHtml += "<h4>Quick Navigation:</h4>";
    navigationHtml += '<div class="nav-numbers">';

    $(".mcq-question").each(function () {
      var questionNum = $(this).data("question");
      navigationHtml +=
        '<button type="button" class="nav-btn" data-question="' +
        questionNum +
        '">' +
        questionNum +
        "</button>";
    });

    navigationHtml += "</div></div>";

    $(".mcq-header").after(navigationHtml);

    // Add navigation styles
    if (!$("#quiz-navigation-styles").length) {
      $("head").append(
        '<style id="quiz-navigation-styles">' +
          ".question-navigation {" +
          "margin: 20px 0;" +
          "padding: 15px;" +
          "background-color: #f5f5f5;" +
          "border-radius: 6px;" +
          "}" +
          ".question-navigation h4 {" +
          "margin: 0 0 10px 0;" +
          "color: #333;" +
          "font-size: 16px;" +
          "}" +
          ".nav-numbers {" +
          "display: flex;" +
          "flex-wrap: wrap;" +
          "gap: 5px;" +
          "}" +
          ".nav-btn {" +
          "width: 35px;" +
          "height: 35px;" +
          "border: 2px solid #ddd;" +
          "background: white;" +
          "border-radius: 4px;" +
          "cursor: pointer;" +
          "font-weight: bold;" +
          "transition: all 0.2s ease;" +
          "white-space: nowrap;" +
          "overflow: hidden;" +
          "text-overflow: ellipsis;" +
          "color: #000;" +
          "display: flex;" +
          "align-items: center;" +
          "justify-content: center;" +
          "text-align: center;" +
          "}" +
          ".nav-btn:hover {" +
          "background-color: #e6f3fa;" +
          "border-color: #0073aa;" +
          "color: #0073aa;" +
          "}" +
          ".nav-btn.answered {" +
          "background-color: #46b450;" +
          "color: white;" +
          "border-color: #46b450;" +
          "}" +
          ".nav-btn.correct {" +
          "background-color: #46b450;" +
          "color: white;" +
          "}" +
          ".nav-btn.incorrect {" +
          "background-color: #dc3232;" +
          "color: white;" +
          "}" +
          "</style>"
      );
    }

    // Navigation click handler
    $(".nav-btn").on("click", function () {
      var questionNum = $(this).data("question");
      var questionElement = $(
        '.mcq-question[data-question="' + questionNum + '"]'
      );

      if (questionElement.length) {
        // Scroll to question
        questionElement[0].scrollIntoView({
          behavior: "smooth",
          block: "center",
        });

        // Highlight briefly
        questionElement.addClass("highlight");
        setTimeout(function () {
          questionElement.removeClass("highlight");
        }, 1000);
      }
    });
  }

  // Update navigation states (keeping existing)
  function updateNavigationStates() {
    $(".mcq-question").each(function () {
      var questionNum = $(this).data("question");
      var navBtn = $('.nav-btn[data-question="' + questionNum + '"]');
      var isAnswered = $(this).hasClass("answered");
      var isCorrect = $(this).hasClass("correct");
      var isIncorrect = $(this).hasClass("incorrect");

      navBtn.removeClass("answered correct incorrect");

      if (isCorrect) {
        navBtn.addClass("correct");
      } else if (isIncorrect) {
        navBtn.addClass("incorrect");
      } else if (isAnswered) {
        navBtn.addClass("answered");
      }
    });
  }

  // Prevent accidental page refresh during quiz
  function preventAccidentalRefresh() {
    let quizStarted = false;

    $("#start-quiz").on("click", function () {
      quizStarted = true;
    });

    $(window).on("beforeunload", function (e) {
      if (quizStarted && $("#quiz-results").is(":hidden")) {
        e.preventDefault();
        e.returnValue =
          "Are you sure you want to leave? Your quiz progress will be lost.";
        return "Are you sure you want to leave? Your quiz progress will be lost.";
      }
    });
  }

  // Initialize everything when page loads (ENHANCED)
  function initialize() {
    initQuiz();
    initKeyboardShortcuts();
    initQuestionNavigation();
    initPDFControls(); // Initialize PDF controls
    preventAccidentalRefresh();
    updateProgress();

    // Add highlight style
    if (!$("#quiz-highlight-styles").length) {
      $("head").append(
        '<style id="quiz-highlight-styles">' +
          ".mcq-question.highlight {" +
          "animation: highlightPulse 1s ease-in-out;" +
          "}" +
          "@keyframes highlightPulse {" +
          "0%, 100% { background-color: transparent; }" +
          "50% { background-color: rgba(0, 115, 170, 0.2); }" +
          "}" +
          "</style>"
      );
    }
  }

  // Start initialization
  initialize();
});
