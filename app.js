document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const attendanceCriterionInput = document.getElementById('attendance-criterion');
    const workingDaysInput = document.getElementById('working-days');
    const durationInput = document.getElementById('duration-input');
    const durationLabel = document.getElementById('duration-label');
    const addSubjectForm = document.getElementById('add-subject-form');
    const subjectNameInput = document.getElementById('subject-name');
    const lecturesPerWeekInput = document.getElementById('lectures-per-week');
    const resultsTableBody = document.querySelector('#results-table tbody');
    const emptyStateRow = document.getElementById('empty-state-row');
    const clearAllBtn = document.getElementById('clear-all-btn');
    const toggleButtons = document.querySelector('.toggle-buttons');
    const toastContainer = document.getElementById('toast-container');
    const weightageChartCanvas = document.getElementById('weightage-chart');
    const dashboardSection = document.getElementById('dashboard-section');

    // Error message elements for inputs
    const attendanceCriterionError = document.getElementById('attendance-criterion-error');
    const workingDaysError = document.getElementById('working-days-error');
    const durationInputError = document.getElementById('duration-input-error');
    const subjectNameError = document.getElementById('subject-name-error');
    const lecturesPerWeekError = document.getElementById('lectures-per-week-error');

    // State variables
    let subjects = JSON.parse(localStorage.getItem('subjects')) || [
        { name: 'Maths', lecturesPerWeek: 5 },
        { name: 'Physics', lecturesPerWeek: 4 },
        { name: 'Chemistry', lecturesPerWeek: 3 },
        { name: 'Biology', lecturesPerWeek: 2 }
    ]; // Start with an empty array if no saved data
    let lastLecturesPerWeek = parseInt(localStorage.getItem('lastLecturesPerWeek')) || 4;
    let calculationMode = localStorage.getItem('calculationMode') || 'weeks';
    let durationValues = JSON.parse(localStorage.getItem('durationValues')) || {
        weeks: 16,
        days: 5 * 16, // Default for 16 weeks * 5 days/week
        months: 4
    };
    let weightageChart = null;

    // --- Utility Functions ---

    const saveState = () => {
        localStorage.setItem('subjects', JSON.stringify(subjects));
        localStorage.setItem('lastLecturesPerWeek', lastLecturesPerWeek.toString());
        localStorage.setItem('calculationMode', calculationMode);
        localStorage.setItem('durationValues', JSON.stringify(durationValues));
    };

    const showToast = (message) => {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('show');
        }, 100); // Small delay to allow CSS transition

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.remove();
            }, 300); // Wait for fade-out transition to complete before removing
        }, 3000); // Toast visible for 3 seconds
    };

    const displayInputError = (inputElement, errorElement, message) => {
        inputElement.classList.add('is-invalid');
        errorElement.textContent = message;
    };

    const clearInputError = (inputElement, errorElement) => {
        inputElement.classList.remove('is-invalid');
        errorElement.textContent = '';
    };

    // --- Core Logic ---

    const renderResults = () => {
        resultsTableBody.innerHTML = ''; // Clear existing rows
        emptyStateRow.style.display = subjects.length === 0 ? 'table-row' : 'none'; // Show/hide empty state
        clearAllBtn.style.display = subjects.length === 0 ? 'none' : 'block'; // Show/hide clear all button

        // Get and validate configuration inputs
        const criterion = parseFloat(attendanceCriterionInput.value) / 100;
        const duration = parseInt(durationInput.value);
        const workingDays = parseInt(workingDaysInput.value);

        // Clear previous errors
        clearInputError(attendanceCriterionInput, attendanceCriterionError);
        clearInputError(durationInput, durationInputError);
        clearInputError(workingDaysInput, workingDaysError);

        let isValidConfig = true;

        if (isNaN(criterion) || criterion <= 0 || criterion > 1) {
            displayInputError(attendanceCriterionInput, attendanceCriterionError, 'Enter a valid % (e.g., 75)');
            isValidConfig = false;
        }
        if (isNaN(duration) || duration <= 0) {
            displayInputError(durationInput, durationInputError, 'Enter a positive number.');
            isValidConfig = false;
        }
        if (isNaN(workingDays) || workingDays <= 0 || workingDays > 7) {
            displayInputError(workingDaysInput, workingDaysError, 'Enter 1-7 days.');
            isValidConfig = false;
        }

        if (!isValidConfig) {
            // Hide chart if config is invalid
            dashboardSection.style.display = 'none';
            if (weightageChart) {
                weightageChart.destroy();
                weightageChart = null;
            }
            return;
        }

        let semesterWeeks;
        switch (calculationMode) {
            case 'days':
                semesterWeeks = duration / workingDays;
                break;
            case 'months':
                semesterWeeks = (duration * 4.345); // Average weeks in a month
                break;
            default: // weeks
                semesterWeeks = duration;
        }

        subjects.forEach((subject, index) => {
            const totalLectures = Math.floor(subject.lecturesPerWeek * semesterWeeks);
            const requiredLectures = Math.ceil(criterion * totalLectures);
            const maxBunks = totalLectures - requiredLectures;
            // Ensure weekly skip limit is not negative
            const weeklySkipLimit = (isFinite(semesterWeeks) && semesterWeeks > 0) ? Math.floor(maxBunks / semesterWeeks) : 0;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td data-label="Subject" contenteditable="true" onblur="updateSubject(${index}, 'name', this.innerText)" class="editable-cell">${subject.name}</td>
                <td data-label="Total Lectures">${totalLectures}</td>
                <td data-label="Min. Required">${requiredLectures}</td>
                <td data-label="Max Bunks" class="${maxBunks >= 0 ? 'safe' : 'danger'}">${maxBunks}</td>
                <td data-label="Weekly Skip Limit" class="${weeklySkipLimit >= 0 ? 'safe' : 'danger'}">${weeklySkipLimit}</td>
                <td data-label="Actions">
                    <button class="remove-btn" onclick="removeSubject(${index})" title="Remove Subject" aria-label="Remove ${subject.name}">&times;</button>
                </td>
            `;
            resultsTableBody.appendChild(row);
        });

        renderWeightageChart(); // Render chart only if config is valid
    };

    // --- Event Listeners ---

    addSubjectForm.addEventListener('submit', (e) => {
        e.preventDefault(); // Prevent default form submission
        const name = subjectNameInput.value.trim();
        const lecturesPerWeek = parseInt(lecturesPerWeekInput.value);

        // Clear previous errors
        clearInputError(subjectNameInput, subjectNameError);
        clearInputError(lecturesPerWeekInput, lecturesPerWeekError);

        let isValidSubjectInput = true;
        if (!name) {
            displayInputError(subjectNameInput, subjectNameError, 'Subject name is required.');
            isValidSubjectInput = false;
        }
        if (isNaN(lecturesPerWeek) || lecturesPerWeek <= 0) {
            displayInputError(lecturesPerWeekInput, lecturesPerWeekError, 'Enter a positive number of lectures.');
            isValidSubjectInput = false;
        }

        if (isValidSubjectInput) {
            subjects.push({ name, lecturesPerWeek });
            lastLecturesPerWeek = lecturesPerWeek; // Save last used value
            subjectNameInput.value = ''; // Clear subject name field
            lecturesPerWeekInput.value = lastLecturesPerWeek; // Set lectures field to last used value
            saveState(); // Save updated subjects to local storage
            renderResults(); // Re-render results table
            showToast('Subject added!'); // Show confirmation toast
            subjectNameInput.focus(); // Focus back to subject name for quick entry
        }
    });

    toggleButtons.addEventListener('click', (e) => {
        if (e.target.classList.contains('toggle-btn')) {
            // Remove 'active' class from current active button
            toggleButtons.querySelector('.active').classList.remove('active');
            // Add 'active' class to clicked button
            e.target.classList.add('active');
            // Update calculation mode
            calculationMode = e.target.dataset.mode;
            saveState(); // Save updated calculation mode
            updateDurationInput(); // Update duration input based on new mode
            renderResults(); // Re-render results with new mode
        }
    });

    const updateDurationInput = () => {
        // Update label and input value based on calculationMode
        switch (calculationMode) {
            case 'days':
                durationLabel.textContent = 'Total Working Days';
                durationInput.value = durationValues.days;
                workingDaysInput.closest('div').style.display = 'block'; // Show working days input
                break;
            case 'months':
                durationLabel.textContent = 'Number of Months';
                durationInput.value = durationValues.months;
                workingDaysInput.closest('div').style.display = 'block'; // Show working days input for months
                break;
            default: // weeks
                durationLabel.textContent = 'Semester Duration (weeks)';
                durationInput.value = durationValues.weeks;
                workingDaysInput.closest('div').style.display = 'block'; // Show working days input
        }
    };

    // Global functions for contenteditable and remove buttons
    window.updateSubject = (index, field, value) => {
        if (field === 'name') {
            const trimmedValue = value.trim();
            if (trimmedValue !== '') {
                subjects[index][field] = trimmedValue;
                saveState();
                showToast('Subject updated!');
                renderResults(); // Re-render to update chart and ensure consistency
            } else {
                renderResults(); // Re-render to restore original value if edit is invalid (empty)
                showToast('Subject name cannot be empty.', 'error'); // Optional: specific error toast
            }
        }
    };

    window.removeSubject = (index) => {
        subjects.splice(index, 1); // Remove subject at specified index
        saveState(); // Save updated subjects
        renderResults(); // Re-render results table
        showToast('Subject removed.'); // Show confirmation toast
    };

    clearAllBtn.addEventListener('click', () => {
        // Confirmation before clearing all subjects
        if (subjects.length > 0 && confirm('Are you sure you want to clear all subjects? This action cannot be undone.')) {
            subjects = []; // Empty the subjects array
            saveState(); // Save empty array
            renderResults(); // Re-render results
            showToast('All subjects cleared.'); // Show confirmation toast
        }
    });

    // Handle ESC key to blur contenteditable fields
    document.body.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const activeElement = document.activeElement;
            if (activeElement && activeElement.hasAttribute('contenteditable')) {
                activeElement.blur(); // Remove focus from contenteditable
            }
        }
    });

    // Event listeners for configuration inputs to trigger re-render on change
    [attendanceCriterionInput, workingDaysInput, durationInput].forEach(input => {
        input.addEventListener('input', () => {
            // Update durationValues object based on the input that changed
            switch (input.id) {
                case 'attendance-criterion': break; // Not part of durationValues
                case 'working-days': durationValues.days = parseInt(input.value) || 0; break;
                case 'duration-input':
                    durationValues[calculationMode] = parseInt(input.value) || 0;
                    break;
            }
            saveState();
            renderResults();
        });
    });

    // --- Chart Logic ---

    const renderWeightageChart = () => {
        if (subjects.length === 0) {
            dashboardSection.style.display = 'none';
            if (weightageChart) {
                weightageChart.destroy();
                weightageChart = null;
            }
            return;
        }
        dashboardSection.style.display = 'block';

        const totalLecturesSum = subjects.reduce((sum, subject) => sum + subject.lecturesPerWeek, 0);

        const chartData = {
            labels: subjects.map(s => s.name),
            datasets: [{
                data: subjects.map(s => s.lecturesPerWeek),
                backgroundColor: [
                    '#4C5C96', // Accent color
                    '#22D3EE', // Safe color (Cyan)
                    '#F87171', // Danger color (Red)
                    '#9CA3AF', // Secondary text (Grey)
                    '#B08A4A', // Muted Amber (from original JS)
                    '#3C8A8A', // Teal (from original JS)
                    '#6F8A4A', // Muted Green (from original JS)
                    '#8A4A6B', // Muted Magenta (from original JS)
                    '#7C3AED', // Violet 600
                    '#FB923C', // Orange 400
                    '#FDE047', // Yellow 400
                    '#10B981'  // Emerald 500
                ].slice(0, subjects.length), // Use only as many colors as subjects
                borderColor: '#1F2937', // Matches surface color
                borderWidth: 1
            }]
        };

        if (weightageChart) {
            weightageChart.destroy(); // Destroy previous chart instance to prevent memory leaks
        }

        weightageChart = new Chart(weightageChartCanvas, {
            type: 'pie',
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false, // Allows chart to fill container width without fixed aspect ratio
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: '#e0e0e0', // Light color for legend labels
                            font: {
                                size: 14 // Adjust font size for readability
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const percentage = totalLecturesSum > 0 ? ((value / totalLecturesSum) * 100).toFixed(1) : 0;
                                return `${label}: ${value} lectures/week (${percentage}%)`;
                            }
                        },
                        titleFont: { size: 14 },
                        bodyFont: { size: 13 },
                        padding: 10,
                        backgroundColor: 'rgba(31, 41, 55, 0.9)', // Matches surface color with some opacity
                        borderColor: '#4A5568', // Subtle border for tooltip
                        borderWidth: 1,
                        boxPadding: 4
                    }
                }
            }
        });
    };

    // --- Initial Load ---
    const initializeApp = () => {
        // Set initial input values from localStorage or defaults
        attendanceCriterionInput.value = localStorage.getItem('attendanceCriterion') || '75';
        workingDaysInput.value = localStorage.getItem('workingDays') || '5';

        // Set active button for calculation mode
        document.querySelectorAll('.toggle-btn').forEach(button => {
            button.classList.remove('active');
            if (button.dataset.mode === calculationMode) {
                button.classList.add('active');
            }
        });

        lecturesPerWeekInput.value = lastLecturesPerWeek; // Set initial value for new subject form

        updateDurationInput(); // Update duration input and label based on initial calculationMode
        renderResults(); // Initial render of results and chart
    };

    // Call initialize on DOMContentLoaded
    initializeApp();

    // Save config inputs on change
    attendanceCriterionInput.addEventListener('input', () => localStorage.setItem('attendanceCriterion', attendanceCriterionInput.value));
    workingDaysInput.addEventListener('input', () => localStorage.setItem('workingDays', workingDaysInput.value));
});
