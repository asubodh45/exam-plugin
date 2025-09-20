jQuery(document).ready(function ($) {
  "use strict";

  // Initialize the quiz
  function initQuiz() {
    // Add event listeners for radio buttons
    $('.mcq-question input[type="radio"]').on("change", function () {
      var questionDiv = $(this).closest(".mcq-question");
      questionDiv.addClass("answered");

      // Update the visual state
      updateQuestionState(questionDiv);
    });

    // Submit quiz button
    $("#submit-quiz").on("click", function () {
      submitQuiz();
    });

    // Reset quiz button
    $("#reset-quiz").on("click", function () {
      resetQuiz();
    });

    // Auto-save functionality (optional)
    setInterval(autoSave, 30000); // Auto-save every 30 seconds
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

  // Collect user answers
  function collectAnswers() {
    var answers = {};
    var quizContainer = $(".pdf-mcq-container");
    var quizId = quizContainer.data("quiz-id");

    $(".mcq-question").each(function () {
      var questionNum = $(this).data("question");
      var selectedAnswer = $(this).find('input[type="radio"]:checked').val();

      if (selectedAnswer) {
        answers[questionNum] = selectedAnswer;
      }
    });

    return {
      quiz_id: quizId,
      answers: answers,
    };
  }

  // Submit quiz
  function submitQuiz() {
    var submitButton = $("#submit-quiz");
    var originalText = submitButton.text();

    // Disable button and show loading state
    submitButton.prop("disabled", true).text("Submitting...");

    var data = collectAnswers();

    if (Object.keys(data.answers).length === 0) {
      alert("Please answer at least one question before submitting.");
      submitButton.prop("disabled", false).text(originalText);
      return;
    }

    // Confirm submission
    if (
      !confirm(
        "Are you sure you want to submit your quiz? This action cannot be undone."
      )
    ) {
      submitButton.prop("disabled", false).text(originalText);
      return;
    }

    // AJAX request to submit answers
    $.ajax({
      url: pdf_mcq_ajax.ajax_url,
      type: "POST",
      data: {
        action: "save_quiz_answers",
        nonce: pdf_mcq_ajax.nonce,
        quiz_id: data.quiz_id,
        answers: data.answers,
      },
      success: function (response) {
        if (response.success) {
          displayResults(response.data);
          disableQuiz();
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

  // Display quiz results
  function displayResults(data) {
    var resultsContainer = $("#quiz-results");
    var resultsContent = $("#results-content");

    // Create results HTML
    var html = "";

    // Summary section
    html += '<div class="results-summary">';
    html += "<h4>Quiz Summary</h4>";
    html +=
      "<p>Correct Answers: <strong>" +
      data.correct_count +
      "</strong> out of <strong>" +
      data.total_questions +
      "</strong></p>";
    html += '<p class="score-display">Score: ' + data.percentage + "%</p>";
    html += "</div>";

    // Individual results
    html += "<h4>Question Results:</h4>";
    html += '<div class="results-grid">';

    $.each(data.results, function (questionNum, result) {
      var statusClass = result.is_correct ? "correct" : "incorrect";
      var statusText = result.is_correct ? "✓" : "✗";

      html += '<div class="result-item ' + statusClass + '">';
      html += "<div>Q" + questionNum + "</div>";
      html += "<div>" + statusText + "</div>";
      html +=
        "<div>Your: " +
        (result.user_answer ? result.user_answer.toUpperCase() : "N/A") +
        "</div>";
      if (!result.is_correct && result.correct_answer) {
        html +=
          "<div>Correct: " + result.correct_answer.toUpperCase() + "</div>";
      }
      html += "</div>";
    });

    html += "</div>";

    // Update results content
    resultsContent.html(html);
    resultsContainer.show().addClass("fade-in");

    // Update question visual states
    $.each(data.results, function (questionNum, result) {
      var questionDiv = $('.mcq-question[data-question="' + questionNum + '"]');
      var statusClass = result.is_correct ? "correct" : "incorrect";
      questionDiv.addClass(statusClass);
    });

    // Scroll to results
    $("html, body").animate(
      {
        scrollTop: resultsContainer.offset().top,
      },
      500
    );
  }

  // Disable quiz after submission
  function disableQuiz() {
    $('.mcq-question input[type="radio"]').prop("disabled", true);
    $("#submit-quiz").prop("disabled", true).text("Quiz Submitted");
    $("#reset-quiz").prop("disabled", true);
    $(".mcq-section").addClass("loading");
  }

  // Reset quiz
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
  }

  // Auto-save functionality
  function autoSave() {
    var data = collectAnswers();
    if (Object.keys(data.answers).length > 0) {
      localStorage.setItem(
        "pdf_mcq_quiz_" + data.quiz_id,
        JSON.stringify(data.answers)
      );
    }
  }

  // Load auto-saved data
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

  // Clear auto-saved data
  function clearAutoSave() {
    var quizContainer = $(".pdf-mcq-container");
    var quizId = quizContainer.data("quiz-id");

    if (quizId) {
      localStorage.removeItem("pdf_mcq_quiz_" + quizId);
    }
  }

  // Show notification
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

  // Progress tracking
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

  // Keyboard shortcuts
  function initKeyboardShortcuts() {
    $(document).on("keydown", function (e) {
      // Only activate shortcuts when focused on quiz area
      if (!$(e.target).closest(".pdf-mcq-container").length) {
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
    });
  }

  // Question navigation
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
          "}" +
          ".nav-btn:hover {" +
          "background-color: #f0f0f0;" +
          "border-color: #0073aa;" +
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

  // Update navigation states
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

  // Initialize everything when page loads
  function initialize() {
    initQuiz();
    initKeyboardShortcuts();
    initQuestionNavigation();
    loadAutoSave();
    updateProgress();

    // Update progress and navigation when answers change
    $('.mcq-question input[type="radio"]').on("change", function () {
      setTimeout(function () {
        updateProgress();
        updateNavigationStates();
      }, 100);
    });

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
