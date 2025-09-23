<?php

/**
 * Plugin Name: PDF MCQ Quiz Enhanced
 * Plugin URI: https://yourwebsite.com
 * Description: Display PDF files with MCQ quiz functionality using shortcodes with result recording
 * Version: 1.1.0
 * Author: Your Name
 * License: GPL v2 or later
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('PDF_MCQ_PLUGIN_URL', plugin_dir_url(__FILE__));
define('PDF_MCQ_PLUGIN_PATH', plugin_dir_path(__FILE__));

class PDF_MCQ_Plugin
{

    public function __construct()
    {
        add_action('init', array($this, 'init'));
        register_activation_hook(__FILE__, array($this, 'activate'));
        register_deactivation_hook(__FILE__, array($this, 'deactivate'));
    }

    public function init()
    {
        // Register Custom Post Type
        $this->register_cpt();
        $this->create_results_table();

        // Add meta boxes
        add_action('add_meta_boxes', array($this, 'add_meta_boxes'));
        add_action('save_post', array($this, 'save_meta_boxes'));

        // Enqueue scripts and styles
        add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));
        add_action('admin_enqueue_scripts', array($this, 'admin_enqueue_scripts'));

        // Register shortcode
        add_shortcode('pdf_mcq_quiz', array($this, 'shortcode_handler'));

        // AJAX handlers
        add_action('wp_ajax_save_quiz_answers', array($this, 'save_quiz_answers'));
        add_action('wp_ajax_nopriv_save_quiz_answers', array($this, 'save_quiz_answers'));

        // Admin menu
        add_action('admin_menu', array($this, 'add_admin_menu'));

        // Global settings
        add_action('admin_init', array($this, 'register_settings'));
    }

    public function activate()
    {
        $this->register_cpt();
        $this->create_results_table();
        flush_rewrite_rules();
    }

    public function deactivate()
    {
        flush_rewrite_rules();
    }

    public function create_results_table()
    {
        global $wpdb;

        $table_name = $wpdb->prefix . 'pdf_mcq_results';

        $charset_collate = $wpdb->get_charset_collate();

        $sql = "CREATE TABLE $table_name (
            id mediumint(9) NOT NULL AUTO_INCREMENT,
            quiz_id bigint(20) NOT NULL,
            user_id bigint(20) DEFAULT 0,
            user_name varchar(255) NOT NULL DEFAULT 'Guest',
            user_email varchar(255) DEFAULT '',
            total_questions int NOT NULL,
            correct_answers int NOT NULL,
            incorrect_answers int NOT NULL,
            unanswered int NOT NULL,
            positive_marks decimal(10,2) NOT NULL,
            negative_marks decimal(10,2) NOT NULL,
            total_marks decimal(10,2) NOT NULL,
            percentage decimal(5,2) NOT NULL,
            user_answers longtext,
            time_taken int DEFAULT 0,
            completed_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY quiz_id (quiz_id),
            KEY user_id (user_id)
        ) $charset_collate;";

        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        dbDelta($sql);
    }

    public function register_cpt()
    {
        $labels = array(
            'name' => 'PDF MCQ Quizzes',
            'singular_name' => 'PDF MCQ Quiz',
            'menu_name' => 'PDF MCQ Quizzes',
            'add_new' => 'Add New Quiz',
            'add_new_item' => 'Add New PDF MCQ Quiz',
            'edit_item' => 'Edit PDF MCQ Quiz',
            'new_item' => 'New PDF MCQ Quiz',
            'view_item' => 'View PDF MCQ Quiz',
            'search_items' => 'Search PDF MCQ Quizzes',
            'not_found' => 'No PDF MCQ Quizzes found',
            'not_found_in_trash' => 'No PDF MCQ Quizzes found in trash'
        );

        $args = array(
            'labels' => $labels,
            'public' => true,
            'has_archive' => false,
            'menu_icon' => 'dashicons-media-document',
            'supports' => array('title'),
            'show_in_menu' => true,
            'menu_position' => 5,
        );

        register_post_type('pdf_mcq_quiz', $args);
    }

    public function add_admin_menu()
    {
        add_submenu_page(
            'edit.php?post_type=pdf_mcq_quiz',
            'Quiz Results',
            'Quiz Results',
            'manage_options',
            'pdf-mcq-results',
            array($this, 'results_page')
        );

        add_submenu_page(
            'edit.php?post_type=pdf_mcq_quiz',
            'Global Settings',
            'Global Settings',
            'manage_options',
            'pdf-mcq-settings',
            array($this, 'settings_page')
        );
    }

    public function register_settings()
    {
        register_setting('pdf_mcq_settings', 'pdf_mcq_global_positive_marks', array(
            'default' => 1,
            'sanitize_callback' => 'floatval'
        ));
        register_setting('pdf_mcq_settings', 'pdf_mcq_global_negative_marks', array(
            'default' => 0.25,
            'sanitize_callback' => 'floatval'
        ));
    }

    public function settings_page()
    {
        $positive_marks = get_option('pdf_mcq_global_positive_marks', 1);
        $negative_marks = get_option('pdf_mcq_global_negative_marks', 0.25);
?>
        <div class="wrap">
            <h1>PDF MCQ Quiz - Global Settings</h1>
            <form method="post" action="options.php">
                <?php settings_fields('pdf_mcq_settings'); ?>
                <table class="form-table">
                    <tr>
                        <th scope="row">Default Marks for Correct Answer</th>
                        <td>
                            <input type="number" step="0.01" min="0" name="pdf_mcq_global_positive_marks" value="<?php echo esc_attr($positive_marks); ?>" />
                            <p class="description">Default marks awarded for each correct answer</p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">Default Negative Marks for Incorrect Answer</th>
                        <td>
                            <input type="number" step="0.01" min="0" name="pdf_mcq_global_negative_marks" value="<?php echo esc_attr($negative_marks); ?>" />
                            <p class="description">Default marks deducted for each incorrect answer (0 for no negative marking)</p>
                        </td>
                    </tr>
                </table>
                <?php submit_button(); ?>
            </form>
        </div>
        <?php
    }

    public function results_page()
    {
        global $wpdb;

        $table_name = $wpdb->prefix . 'pdf_mcq_results';

        // Handle individual result view
        if (isset($_GET['view']) && intval($_GET['view'])) {
            $result_id = intval($_GET['view']);
            $result = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table_name WHERE id = %d", $result_id));

            if ($result) {
                $quiz = get_post($result->quiz_id);
                $correct_answers = get_post_meta($result->quiz_id, '_correct_answers', true) ?: array();
                $user_answers = json_decode($result->user_answers, true) ?: array();

        ?>
                <div class="wrap">
                    <h1>Quiz Result Details</h1>
                    <p><a href="<?php echo admin_url('edit.php?post_type=pdf_mcq_quiz&page=pdf-mcq-results'); ?>">&larr; Back to Results</a></p>

                    <div class="result-summary" style="background: #fff; padding: 20px; border: 1px solid #ccd0d4; margin-bottom: 20px;">
                        <h2>Summary</h2>
                        <table class="form-table">
                            <tr>
                                <th>Quiz:</th>
                                <td><?php echo esc_html($quiz->post_title); ?></td>
                            </tr>
                            <tr>
                                <th>User:</th>
                                <td><?php echo esc_html($result->user_name); ?><?php if ($result->user_email) echo ' (' . esc_html($result->user_email) . ')'; ?></td>
                            </tr>
                            <tr>
                                <th>Completed:</th>
                                <td><?php echo esc_html($result->completed_at); ?></td>
                            </tr>
                            <tr>
                                <th>Total Questions:</th>
                                <td><?php echo esc_html($result->total_questions); ?></td>
                            </tr>
                            <tr>
                                <th>Correct:</th>
                                <td style="color: green;"><?php echo esc_html($result->correct_answers); ?></td>
                            </tr>
                            <tr>
                                <th>Incorrect:</th>
                                <td style="color: red;"><?php echo esc_html($result->incorrect_answers); ?></td>
                            </tr>
                            <tr>
                                <th>Unanswered:</th>
                                <td style="color: orange;"><?php echo esc_html($result->unanswered); ?></td>
                            </tr>
                            <tr>
                                <th>Total Marks:</th>
                                <td><strong><?php echo esc_html($result->total_marks); ?></strong></td>
                            </tr>
                            <tr>
                                <th>Percentage:</th>
                                <td><strong><?php echo esc_html($result->percentage); ?>%</strong></td>
                            </tr>
                        </table>
                    </div>

                    <div class="question-wise-results" style="background: #fff; padding: 20px; border: 1px solid #ccd0d4;">
                        <h2>Question-wise Results</h2>
                        <table class="wp-list-table widefat fixed striped">
                            <thead>
                                <tr>
                                    <th>Question</th>
                                    <th>User Answer</th>
                                    <th>Correct Answer</th>
                                    <th>Result</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php
                                for ($i = 1; $i <= $result->total_questions; $i++) {
                                    $user_answer = isset($user_answers[$i]) ? strtoupper($user_answers[$i]) : 'Not Answered';
                                    $correct_answer = isset($correct_answers[$i]) ? strtoupper($correct_answers[$i]) : 'Not Set';

                                    $is_correct = isset($user_answers[$i]) && isset($correct_answers[$i]) && $user_answers[$i] === $correct_answers[$i];
                                    $is_unanswered = !isset($user_answers[$i]) || empty($user_answers[$i]);

                                    $result_text = $is_unanswered ? 'Unanswered' : ($is_correct ? 'Correct' : 'Incorrect');
                                    $row_class = $is_unanswered ? 'unanswered' : ($is_correct ? 'correct' : 'incorrect');
                                ?>
                                    <tr class="<?php echo $row_class; ?>">
                                        <td><?php echo $i; ?></td>
                                        <td><?php echo esc_html($user_answer); ?></td>
                                        <td><?php echo esc_html($correct_answer); ?></td>
                                        <td>
                                            <span style="color: <?php echo $is_unanswered ? 'orange' : ($is_correct ? 'green' : 'red'); ?>;">
                                                <?php echo $result_text; ?>
                                            </span>
                                        </td>
                                    </tr>
                                <?php
                                }
                                ?>
                            </tbody>
                        </table>
                    </div>
                </div>
                <style>
                    .correct {
                        background-color: #e8f5e8;
                    }

                    .incorrect {
                        background-color: #fce8e8;
                    }

                    .unanswered {
                        background-color: #fff3cd;
                    }
                </style>
        <?php
                return;
            }
        }

        // Main results list
        $results = $wpdb->get_results("SELECT r.*, p.post_title as quiz_title FROM $table_name r LEFT JOIN {$wpdb->posts} p ON r.quiz_id = p.ID ORDER BY r.completed_at DESC LIMIT 100");
        ?>
        <div class="wrap">
            <h1>Quiz Results</h1>
            <table class="wp-list-table widefat fixed striped">
                <thead>
                    <tr>
                        <th>Quiz</th>
                        <th>User</th>
                        <th>Completed</th>
                        <th>Score</th>
                        <th>Percentage</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($results as $result): ?>
                        <tr>
                            <td><?php echo esc_html($result->quiz_title); ?></td>
                            <td><?php echo esc_html($result->user_name); ?></td>
                            <td><?php echo esc_html($result->completed_at); ?></td>
                            <td><?php echo esc_html($result->correct_answers . '/' . $result->total_questions); ?></td>
                            <td><?php echo esc_html($result->percentage); ?>%</td>
                            <td>
                                <a href="<?php echo admin_url('edit.php?post_type=pdf_mcq_quiz&page=pdf-mcq-results&view=' . $result->id); ?>" class="button button-small">View Details</a>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    <?php
    }

    public function add_meta_boxes()
    {
        add_meta_box(
            'pdf_upload_meta_box',
            'PDF Upload',
            array($this, 'pdf_upload_meta_box_callback'),
            'pdf_mcq_quiz',
            'normal',
            'high'
        );

        add_meta_box(
            'mcq_settings_meta_box',
            'MCQ Settings',
            array($this, 'mcq_settings_meta_box_callback'),
            'pdf_mcq_quiz',
            'normal',
            'high'
        );

        add_meta_box(
            'marking_scheme_meta_box',
            'Marking Scheme',
            array($this, 'marking_scheme_meta_box_callback'),
            'pdf_mcq_quiz',
            'side',
            'default'
        );
    }

    public function marking_scheme_meta_box_callback($post)
    {
        $global_positive = get_option('pdf_mcq_global_positive_marks', 1);
        $global_negative = get_option('pdf_mcq_global_negative_marks', 0.25);

        $positive_marks = get_post_meta($post->ID, '_positive_marks', true) ?: $global_positive;
        $negative_marks = get_post_meta($post->ID, '_negative_marks', true) ?: $global_negative;

        echo '<table class="form-table">';
        echo '<tr>';
        echo '<th><label for="positive_marks">Marks for Correct Answer:</label></th>';
        echo '<td>';
        echo '<input type="number" step="0.01" min="0" id="positive_marks" name="positive_marks" value="' . esc_attr($positive_marks) . '" style="width: 100%;" />';
        echo '<p class="description">Global default: ' . $global_positive . '</p>';
        echo '</td>';
        echo '</tr>';
        echo '<tr>';
        echo '<th><label for="negative_marks">Negative Marks for Incorrect:</label></th>';
        echo '<td>';
        echo '<input type="number" step="0.01" min="0" id="negative_marks" name="negative_marks" value="' . esc_attr($negative_marks) . '" style="width: 100%;" />';
        echo '<p class="description">Global default: ' . $global_negative . ' (0 for no negative marking)</p>';
        echo '</td>';
        echo '</tr>';
        echo '</table>';
    }

    public function pdf_upload_meta_box_callback($post)
    {
        wp_nonce_field('pdf_mcq_meta_box', 'pdf_mcq_meta_box_nonce');

        $pdf_url = get_post_meta($post->ID, '_pdf_url', true);

        echo '<table class="form-table">';
        echo '<tr>';
        echo '<th><label for="pdf_url">PDF File:</label></th>';
        echo '<td>';
        echo '<input type="url" id="pdf_url" name="pdf_url" value="' . esc_attr($pdf_url) . '" size="50" />';
        echo '<input type="button" id="upload_pdf_button" class="button" value="Upload PDF" />';
        echo '<p class="description">Upload or select a PDF file.</p>';
        echo '</td>';
        echo '</tr>';
        echo '</table>';
    }

    public function mcq_settings_meta_box_callback($post)
    {
        $number_of_questions = get_post_meta($post->ID, '_number_of_questions', true) ?: 50;
        $number_of_answers = get_post_meta($post->ID, '_number_of_answers', true) ?: 4;
        $correct_answers = get_post_meta($post->ID, '_correct_answers', true) ?: array();
        $exam_time = get_post_meta($post->ID, '_exam_time', true) ?: 30;

        echo '<div id="mcq-settings">';
        echo '<table class="form-table">';
        echo '<tr>';
        echo '<th><label for="number_of_questions">Number of Questions:</label></th>';
        echo '<td>';
        echo '<input type="number" id="number_of_questions" name="number_of_questions" value="' . esc_attr($number_of_questions) . '" min="1" max="200" />';
        echo '<button type="button" id="update_questions" class="button">Update Questions</button>';
        echo '</td>';
        echo '</tr>';
        // echo '<tr>';
        // echo '<th><label for="number_of_answers">Number of Answers (A, B, ...):</label></th>';
        // echo '<td>';
        // echo '<input type="number" id="number_of_answers" name="number_of_answers" value="' . esc_attr($number_of_answers) . '" min="2" max="10" />';
        // echo '<button type="button" id="update_answers" class="button">Update Answers</button>';
        // echo '</td>';
        // echo '</tr>';
        echo '<tr>';
        echo '<th><label for="exam_time">Exam Time (minutes):</label></th>';
        echo '<td>';
        echo '<input type="number" id="exam_time" name="exam_time" value="' . esc_attr($exam_time) . '" min="1" max="300" />';
        echo '</td>';
        echo '</tr>';
        echo '</table>';

        echo '<div id="questions-container">';
        echo '<h3>Set Correct Answers for Each Question:</h3>';
        echo '<div class="questions-grid">';

        for ($i = 1; $i <= $number_of_questions; $i++) {
            $correct_answer = isset($correct_answers[$i]) ? $correct_answers[$i] : '';
            echo '<div class="question-item">';
            echo '<label>Q' . $i . ':</label>';
            echo '<select name="correct_answers[' . $i . ']">';
            echo '<option value="">Select</option>';
            for ($j = 0; $j < $number_of_answers; $j++) {
                $option = chr(97 + $j);
                $option_label = strtoupper($option);
                echo '<option value="' . $option . '"' . selected($correct_answer, $option, false) . '>' . $option_label . '</option>';
            }
            echo '</select>';
            echo '</div>';
        }

        echo '</div>';
        echo '</div>';
        echo '</div>';
    }

    public function save_meta_boxes($post_id)
    {
        if (!isset($_POST['pdf_mcq_meta_box_nonce']) || !wp_verify_nonce($_POST['pdf_mcq_meta_box_nonce'], 'pdf_mcq_meta_box')) {
            return;
        }

        if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) {
            return;
        }

        if (!current_user_can('edit_post', $post_id)) {
            return;
        }

        if (isset($_POST['pdf_url'])) {
            update_post_meta($post_id, '_pdf_url', sanitize_url($_POST['pdf_url']));
        }

        if (isset($_POST['number_of_questions'])) {
            update_post_meta($post_id, '_number_of_questions', intval($_POST['number_of_questions']));
        }

        if (isset($_POST['number_of_answers'])) {
            update_post_meta($post_id, '_number_of_answers', intval($_POST['number_of_answers']));
        }

        if (isset($_POST['exam_time'])) {
            update_post_meta($post_id, '_exam_time', intval($_POST['exam_time']));
        }

        if (isset($_POST['positive_marks'])) {
            update_post_meta($post_id, '_positive_marks', floatval($_POST['positive_marks']));
        }

        if (isset($_POST['negative_marks'])) {
            update_post_meta($post_id, '_negative_marks', floatval($_POST['negative_marks']));
        }

        if (isset($_POST['correct_answers'])) {
            $correct_answers = array();
            foreach ($_POST['correct_answers'] as $question_num => $answer) {
                if (!empty($answer)) {
                    $correct_answers[intval($question_num)] = sanitize_text_field($answer);
                }
            }
            update_post_meta($post_id, '_correct_answers', $correct_answers);
        }
    }

    public function enqueue_scripts()
    {
        wp_enqueue_script('pdf-mcq-frontend', PDF_MCQ_PLUGIN_URL . 'assets/frontend.js', array('jquery'), '1.1.0', true);
        wp_enqueue_style('pdf-mcq-frontend', PDF_MCQ_PLUGIN_URL . 'assets/frontend.css', array(), '1.1.0');

        wp_localize_script('pdf-mcq-frontend', 'pdf_mcq_ajax', array(
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('pdf_mcq_nonce')
        ));
    }

    public function admin_enqueue_scripts($hook)
    {
        global $post_type;

        if ($post_type == 'pdf_mcq_quiz') {
            wp_enqueue_media();
            wp_enqueue_script('pdf-mcq-admin', PDF_MCQ_PLUGIN_URL . 'assets/admin.js', array('jquery'), '1.1.0', true);
            wp_enqueue_style('pdf-mcq-admin', PDF_MCQ_PLUGIN_URL . 'assets/admin.css', array(), '1.1.0');
        }
    }

    public function shortcode_handler($atts)
    {
        $atts = shortcode_atts(array(
            'id' => 0,
        ), $atts);

        $quiz_id = intval($atts['id']);

        if (!$quiz_id || get_post_type($quiz_id) !== 'pdf_mcq_quiz') {
            return '<p>Invalid quiz ID.</p>';
        }

        $pdf_url = get_post_meta($quiz_id, '_pdf_url', true);
        $number_of_questions = get_post_meta($quiz_id, '_number_of_questions', true) ?: 50;
        $correct_answers = get_post_meta($quiz_id, '_correct_answers', true) ?: array();
        $exam_time = get_post_meta($quiz_id, '_exam_time', true) ?: 30;
        $positive_marks = get_post_meta($quiz_id, '_positive_marks', true) ?: get_option('pdf_mcq_global_positive_marks', 1);
        $negative_marks = get_post_meta($quiz_id, '_negative_marks', true) ?: get_option('pdf_mcq_global_negative_marks', 0.25);

        if (!$pdf_url) {
            return '<p>No PDF file found for this quiz.</p>';
        }

        // Enqueue PDF.js
        wp_enqueue_script('pdfjs', 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', array(), '3.11.174', true);

        ob_start();
    ?>
        <div class="pdf-mcq-container" data-quiz-id="<?php echo esc_attr($quiz_id); ?>" data-positive-marks="<?php echo esc_attr($positive_marks); ?>" data-negative-marks="<?php echo esc_attr($negative_marks); ?>">
            <!-- User Info Collection -->
            <div class="user-info-section" id="user-info-section" style="background: #fff; padding: 20px; border: 1px solid #ddd; border-radius: 5px; margin-bottom: 20px;">
                <h3>Student Information</h3>
                <table class="form-table">
                    <tr>
                        <th><label for="student-name">Name:</label></th>
                        <td><input type="text" id="student-name" placeholder="Enter your name" style="width: 100%; max-width: 300px;" required /></td>
                    </tr>
                    <tr>
                        <th><label for="student-email">Email (optional):</label></th>
                        <td><input type="email" id="student-email" placeholder="Enter your email" style="width: 100%; max-width: 300px;" /></td>
                    </tr>
                </table>
                <button type="button" id="start-quiz" class="button button-primary">Start Quiz</button>
            </div>

            <div class="pdf-mcq-content" style="display: none;">
                <div class="mcq-section">
                    <div class="mcq-header">
                        <h3>Answer Sheet</h3>
                        <div class="mcq-controls">
                            <button type="button" id="submit-quiz" class="button button-primary">Submit Quiz</button>
                        </div>
                    </div>
                    <div class="exam-timer" data-time="<?php echo esc_attr($exam_time); ?>">
                        Time Left: <span id="timer-display"></span>
                    </div>
                    <div class="marking-info" style="background: #e7f3ff; padding: 10px; margin-bottom: 15px; border-radius: 5px; font-size: 14px;">
                        <strong>Marking Scheme:</strong> +<?php echo $positive_marks; ?> for correct, -<?php echo $negative_marks; ?> for incorrect
                    </div>
                    <div class="mcq-grid">
                        <?php for ($i = 1; $i <= $number_of_questions; $i++): ?>
                            <div class="mcq-question" data-question="<?php echo $i; ?>">
                                <span class="question-number"><?php echo $i; ?></span>
                                <div class="mcq-options">
                                    <label><input type="radio" name="question_<?php echo $i; ?>" value="a"> A</label>
                                    <label><input type="radio" name="question_<?php echo $i; ?>" value="b"> B</label>
                                    <label><input type="radio" name="question_<?php echo $i; ?>" value="c"> C</label>
                                    <label><input type="radio" name="question_<?php echo $i; ?>" value="d"> D</label>
                                </div>
                            </div>
                        <?php endfor; ?>
                    </div>
                </div>

                <div class="pdf-section">
                    <div class="pdf-controls">
                        <button id="prev-page" class="button">← Previous</button>
                        <span id="page-info">Page <span id="page-num">1</span> of <span id="page-count">-</span></span>
                        <button id="next-page" class="button">Next →</button>
                        <button id="zoom-in" class="button">🔍+</button>
                        <button id="zoom-out" class="button">🔍-</button>
                        <button id="fit-width" class="button">↔ Fit Width</button>
                    </div>

                    <div class="pdf-viewer-container">
                        <canvas id="pdf-canvas"
                            data-pdf-url="<?php echo esc_attr($pdf_url); ?>"
                            style="border: 1px solid #ccc; max-width: 100%; display: none;">
                        </canvas>

                        <div id="pdf-loading" style="text-align: center; padding: 50px; background: #f9f9f9; border: 1px solid #ddd; border-radius: 5px;">
                            <div style="font-size: 16px; margin-bottom: 10px;">📄 Loading PDF...</div>
                            <div style="font-size: 12px; color: #666;">
                                If PDF doesn't load, <a href="<?php echo esc_url($pdf_url); ?>" target="_blank" style="color: #0073aa;">click here to open directly</a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="quiz-results" id="quiz-results" style="display: none;">
                <h3>Quiz Results</h3>
                <div id="results-content"></div>
            </div>
        </div>

        <style>
            .pdf-mcq-content {
                display: flex;
                gap: 20px;
                align-items: flex-start;
            }

            .mcq-section {
                flex: 0 0 400px;
                max-height: 800px;
                overflow-y: auto;
                border: 1px solid #ddd;
                border-radius: 5px;
                padding: 15px;
                background: #fff;
            }

            .pdf-section {
                flex: 1;
                min-height: 800px;
                border: 1px solid #ddd;
                border-radius: 5px;
                padding: 10px;
                background: #fff;
            }

            .pdf-controls {
                margin-bottom: 10px;
                padding: 10px;
                background: #f8f9fa;
                border-radius: 5px;
                text-align: center;
                border: 1px solid #e0e0e0;
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 10px;
                flex-wrap: wrap;
            }

            .pdf-controls button {
                padding: 6px 12px;
                border: 1px solid #ccc;
                background: white;
                border-radius: 3px;
                cursor: pointer;
                font-size: 13px;
                transition: all 0.2s;
                white-space: nowrap;
            }

            .pdf-controls button:hover:not(:disabled) {
                background: #e6f3fa;
                border-color: #0073aa;
                color: #0073aa;
            }

            .pdf-controls button:disabled {
                opacity: 0.5;
                cursor: not-allowed;
                background: #f5f5f5;
            }

            #page-info {
                font-weight: bold;
                color: #333;
                padding: 0 10px;
                white-space: nowrap;
            }

            .pdf-viewer-container {
                text-align: center;
                max-height: 700px;
                overflow: auto;
                border: 1px solid #ddd;
                border-radius: 3px;
                background: #f0f0f0;
                padding: 10px;
            }

            #pdf-canvas {
                max-width: 80%;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                background: white;
                margin: 0 auto;
                display: block;
            }

            .mcq-grid {
                display: grid;
                grid-template-columns: 1fr;
                gap: 10px;
                padding: 10px 0;
            }

            .mcq-question {
                border: 1px solid #ddd;
                padding: 10px;
                border-radius: 5px;
                background: #fafafa;
                transition: all 0.2s;
            }

            .mcq-question.answered {
                border-color: #46b450;
                background: #f0f8f0;
            }

            .mcq-question.correct {
                border-color: #46b450;
                background: #e8f5e8;
            }

            .mcq-question.incorrect {
                border-color: #dc3232;
                background: #fce8e8;
            }

            .question-number {
                font-weight: bold;
                display: block;
                margin-bottom: 8px;
                color: #333;
            }

            .mcq-options label {
                display: block;
                margin: 4px 0;
                cursor: pointer;
                padding: 2px 0;
                transition: color 0.2s;
            }

            .mcq-options label:hover {
                color: #0073aa;
            }

            .mcq-options input[type="radio"] {
                margin-right: 8px;
            }

            .exam-timer {
                background: linear-gradient(135deg, #fff3cd, #ffeaa7);
                border: 1px solid #ffc107;
                padding: 12px;
                border-radius: 5px;
                text-align: center;
                margin-bottom: 15px;
                font-weight: bold;
                color: #856404;
            }

            .mcq-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
                padding-bottom: 10px;
                border-bottom: 1px solid #eee;
            }

            .mcq-header h3 {
                margin: 0;
                color: #333;
            }

            /* Responsive adjustments */
            @media (max-width: 768px) {
                .pdf-mcq-content {
                    flex-direction: column;
                }

                .mcq-section {
                    flex: none;
                    max-height: none;
                    order: 2;
                }

                .pdf-section {
                    flex: none;
                    order: 1;
                    min-height: 400px;
                }

                .pdf-controls {
                    justify-content: center;
                }

                .pdf-controls button {
                    font-size: 12px;
                    padding: 4px 8px;
                }

                .pdf-viewer-container {
                    text-align: center;
                    max-height: 700px;
                    overflow: auto;
                    border: 1px solid #ddd;
                    border-radius: 3px;
                    background: #f0f0f0;
                    padding: 10px;
                    width: 80%;
                    margin: 0 auto;
                }
            }
        </style>

<?php
        return ob_get_clean();
    }

    public function save_quiz_answers()
    {
        check_ajax_referer('pdf_mcq_nonce', 'nonce');

        $quiz_id = intval($_POST['quiz_id']);
        $user_answers = $_POST['answers'];
        $user_name = sanitize_text_field($_POST['user_name']) ?: 'Guest';
        $user_email = sanitize_email($_POST['user_email']) ?: '';
        $time_taken = intval($_POST['time_taken']) ?: 0;

        $correct_answers = get_post_meta($quiz_id, '_correct_answers', true) ?: array();
        $positive_marks = get_post_meta($quiz_id, '_positive_marks', true) ?: get_option('pdf_mcq_global_positive_marks', 1);
        $negative_marks = get_post_meta($quiz_id, '_negative_marks', true) ?: get_option('pdf_mcq_global_negative_marks', 0.25);

        $results = array();
        $correct_count = 0;
        $incorrect_count = 0;
        $unanswered_count = 0;
        $total_questions = count($user_answers);

        // Calculate results
        foreach ($user_answers as $question_num => $user_answer) {
            $is_correct = isset($correct_answers[$question_num]) &&
                $correct_answers[$question_num] === $user_answer;

            $is_unanswered = empty($user_answer);

            if ($is_unanswered) {
                $unanswered_count++;
            } elseif ($is_correct) {
                $correct_count++;
            } else {
                $incorrect_count++;
            }

            $results[$question_num] = array(
                'user_answer' => $user_answer,
                'correct_answer' => isset($correct_answers[$question_num]) ? $correct_answers[$question_num] : '',
                'is_correct' => $is_correct,
                'is_unanswered' => $is_unanswered
            );
        }

        // Calculate marks
        $positive_total = $correct_count * $positive_marks;
        $negative_total = $incorrect_count * $negative_marks;
        $total_marks = $positive_total - $negative_total;
        $max_possible_marks = $total_questions * $positive_marks;
        $percentage = $max_possible_marks > 0 ? round(($total_marks / $max_possible_marks) * 100, 2) : 0;

        // Get user info
        $current_user = wp_get_current_user();
        $user_id = $current_user->ID;
        if ($user_id && empty($user_name)) {
            $user_name = $current_user->display_name;
            if (empty($user_email)) {
                $user_email = $current_user->user_email;
            }
        }

        // Save to database
        global $wpdb;
        $table_name = $wpdb->prefix . 'pdf_mcq_results';

        $wpdb->insert(
            $table_name,
            array(
                'quiz_id' => $quiz_id,
                'user_id' => $user_id,
                'user_name' => $user_name,
                'user_email' => $user_email,
                'total_questions' => $total_questions,
                'correct_answers' => $correct_count,
                'incorrect_answers' => $incorrect_count,
                'unanswered' => $unanswered_count,
                'positive_marks' => $positive_total,
                'negative_marks' => $negative_total,
                'total_marks' => $total_marks,
                'percentage' => $percentage,
                'user_answers' => json_encode($user_answers),
                'time_taken' => $time_taken,
                'completed_at' => current_time('mysql')
            ),
            array('%d', '%d', '%s', '%s', '%d', '%d', '%d', '%d', '%f', '%f', '%f', '%f', '%s', '%d', '%s')
        );

        wp_send_json_success(array(
            'results' => $results,
            'correct_count' => $correct_count,
            'incorrect_count' => $incorrect_count,
            'unanswered_count' => $unanswered_count,
            'total_questions' => $total_questions,
            'positive_marks' => $positive_total,
            'negative_marks' => $negative_total,
            'total_marks' => $total_marks,
            'percentage' => $percentage,
            'max_possible_marks' => $max_possible_marks
        ));
    }
}

new PDF_MCQ_Plugin();
