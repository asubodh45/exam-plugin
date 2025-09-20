<?php

/**
 * Plugin Name: PDF MCQ Quiz
 * Plugin URI: https://yourwebsite.com
 * Description: Display PDF files with MCQ quiz functionality using shortcodes
 * Version: 1.0.0
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
    }

    public function activate()
    {
        $this->register_cpt();
        flush_rewrite_rules();
    }

    public function deactivate()
    {
        flush_rewrite_rules();
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
        $correct_answers = get_post_meta($post->ID, '_correct_answers', true) ?: array();

        echo '<div id="mcq-settings">';
        echo '<table class="form-table">';
        echo '<tr>';
        echo '<th><label for="number_of_questions">Number of Questions:</label></th>';
        echo '<td>';
        echo '<input type="number" id="number_of_questions" name="number_of_questions" value="' . esc_attr($number_of_questions) . '" min="1" max="200" />';
        echo '<button type="button" id="update_questions" class="button">Update Questions</button>';
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
            echo '<option value="a"' . selected($correct_answer, 'a', false) . '>A</option>';
            echo '<option value="b"' . selected($correct_answer, 'b', false) . '>B</option>';
            echo '<option value="c"' . selected($correct_answer, 'c', false) . '>C</option>';
            echo '<option value="d"' . selected($correct_answer, 'd', false) . '>D</option>';
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
        wp_enqueue_script('pdf-mcq-frontend', PDF_MCQ_PLUGIN_URL . 'assets/frontend.js', array('jquery'), '1.0.0', true);
        wp_enqueue_style('pdf-mcq-frontend', PDF_MCQ_PLUGIN_URL . 'assets/frontend.css', array(), '1.0.0');

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
            wp_enqueue_script('pdf-mcq-admin', PDF_MCQ_PLUGIN_URL . 'assets/admin.js', array('jquery'), '1.0.0', true);
            wp_enqueue_style('pdf-mcq-admin', PDF_MCQ_PLUGIN_URL . 'assets/admin.css', array(), '1.0.0');
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

        if (!$pdf_url) {
            return '<p>No PDF file found for this quiz.</p>';
        }

        ob_start();
?>
        <div class="pdf-mcq-container" data-quiz-id="<?php echo esc_attr($quiz_id); ?>">
            <div class="pdf-mcq-content">
                <div class="mcq-section">
                    <div class="mcq-header">
                        <h3>Answer Sheet</h3>
                        <div class="mcq-controls">
                            <button type="button" id="submit-quiz" class="button button-primary">Submit Quiz</button>
                            <button type="button" id="reset-quiz" class="button">Reset</button>
                        </div>
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
                    <iframe src="<?php echo esc_url($pdf_url); ?>"
                        width="100%"
                        height="800px"
                        style="border: none;">
                        <p>Your browser does not support PDF viewing.
                            <a href="<?php echo esc_url($pdf_url); ?>" target="_blank">Download the PDF</a>
                        </p>
                    </iframe>
                </div>
            </div>

            <div class="quiz-results" id="quiz-results" style="display: none;">
                <h3>Quiz Results</h3>
                <div id="results-content"></div>
            </div>
        </div>
<?php
        return ob_get_clean();
    }

    public function save_quiz_answers()
    {
        check_ajax_referer('pdf_mcq_nonce', 'nonce');

        $quiz_id = intval($_POST['quiz_id']);
        $user_answers = $_POST['answers'];
        $correct_answers = get_post_meta($quiz_id, '_correct_answers', true) ?: array();

        $results = array();
        $correct_count = 0;
        $total_questions = count($user_answers);

        foreach ($user_answers as $question_num => $user_answer) {
            $is_correct = isset($correct_answers[$question_num]) &&
                $correct_answers[$question_num] === $user_answer;

            if ($is_correct) {
                $correct_count++;
            }

            $results[$question_num] = array(
                'user_answer' => $user_answer,
                'correct_answer' => isset($correct_answers[$question_num]) ? $correct_answers[$question_num] : '',
                'is_correct' => $is_correct
            );
        }

        $percentage = $total_questions > 0 ? round(($correct_count / $total_questions) * 100, 2) : 0;

        wp_send_json_success(array(
            'results' => $results,
            'correct_count' => $correct_count,
            'total_questions' => $total_questions,
            'percentage' => $percentage
        ));
    }
}

new PDF_MCQ_Plugin();
