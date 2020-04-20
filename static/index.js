async function sendCommand(command, args) {
    const response = await fetch("/api/" + command, {
        method: "POST",
        body: JSON.stringify(args),
        headers: { "Content-Type": "application/json" },
    })

    text = await response.text()

    try {
        data = JSON.parse(text)
    } catch (e) {
        console.error('Response is not a valid JSON object.')
        console.log(text)
        throw 'Response is not a valid JSON object.'
    }

    if (response.status !== 200) {
        throw data.error;
    }
    return data;
}

function startRegistration() {
    sendCommand("startRegistration", {}).then((response) => {
        console.log("Registration started!")
    }).catch((error) => {
        console.warn("Could not start registration: " + error)
    });
}

function stopRegistration() {
    sendCommand("stopRegistration", {}).then((response) => {
        console.log('Registration stopped!')
    }).catch((error) => {
        console.warn('Could not stop registration: ' + error)
    });
}

function stopQuestion() {
    sendCommand("stopQuestion", {}).then((response) => {
        console.log("Question stopped!")
    }).catch((error) => {
        console.warn("Could not stop question: " + error)
    });
}

function updateTextContent(elementId, newTextContent) {
    const element = document.getElementById(elementId)
    if (element.textContent != newTextContent) {
        element.textContent = newTextContent
    }
}


class QuizController {
    constructor(document, numberOfQuestions) {
        this.document = document
        this.numberOfQuestions = numberOfQuestions
        this.status = null
        this.teamsIndex = new Map() // teamId -> Team
        this.answersIndex = new Map() // question -> teamId -> Answer
        this.currentQuestion = 1
        this.lastSeenTeamsUpdateId = 0
        this.lastSeenAnswersUpdateId = 0
    }

    init() {
        this.initResultsTable()
    }

    updateStatusTable(status) {
        updateTextContent('status_quiz_cell', status.quiz_id)
        updateTextContent('status_language_cell', status.language)
        updateTextContent('status_question_cell', status.question)
        updateTextContent('status_registration_cell', status.registration.toString())
        updateTextContent('status_last_changed_cell', status.time)
    }

    initResultsTable() {
        const table = this.document.getElementById('results_table')
        const resultsTableHeaderRow = table.insertRow(0)
        resultsTableHeaderRow.insertCell(-1)
        resultsTableHeaderRow.insertCell(-1).textContent = 'Total'

        const resultsStartQuestionRow = table.insertRow(-1)
        resultsStartQuestionRow.insertCell(-1)
        resultsStartQuestionRow.insertCell(-1)

        const showAnswersRow = table.insertRow(-1)
        showAnswersRow.insertCell(-1)
        showAnswersRow.insertCell(-1)

        for (let question = 1; question <= this.numberOfQuestions; question++) {
            resultsTableHeaderRow.insertCell(-1).textContent = question
            const startQuestionButton = this.document.createElement('button')
            startQuestionButton.textContent = '>'
            startQuestionButton.onclick = () => {
                sendCommand("startQuestion", { "question_id": '0' + question.toString() }).then((response) => {
                    console.log("Question '" + question + "' started!")
                }).catch((error) => {
                    console.warn("Could not start question: " + error)
                });
            }

            const showAnswersButton = this.document.createElement('button')
            showAnswersButton.textContent = 'A'
            showAnswersButton.onclick = () => { this.showAnswersForQuestion(question) }

            resultsStartQuestionRow.insertCell(-1).appendChild(startQuestionButton)
            showAnswersRow.insertCell(-1).appendChild(showAnswersButton)
        }
    }

    updateResultsTable() {
        const table = document.getElementById('results_table')

        for (const [teamId, team] of teamsIndex) {
            const rowId = 'results_team_' + teamId + '_row'
            var row = document.getElementById(rowId)
            if (!row) {
                row = table.insertRow(-1)
                row.id = rowId

                row.insertCell(-1)
                row.insertCell(-1)
                for (let q = 1; q <= this.numberOfQuestions; q++) {
                    row.insertCell(-1).textContent = '0'
                }
            }
            // TODO: make it a function.
            if (row.cells[0].textContent != team.name) {
                row.cells[0].textContent = team.name
            }
        }
    }

    showAnswersForQuestion(question) {
        this.currentQuestion = question
        this.updateAnswersTable()
    }

    updateAnswersTable() {
        const table = this.document.getElementById('answers_table')

        if (this.answersIndex.has(this.currentQuestion)) {
            var answers = this.answersIndex.get(this.currentQuestion)
        } else {
            var answers = new Map()
        }

        for (const [teamId, team] of this.teamsIndex) {
            const rowId = 'answers_team_' + teamId + '_row'
            var row = this.document.getElementById(rowId)
            if (!row) {
                row = table.insertRow(-1)
                row.id = rowId
                row.insertCell(-1).textContent = team.name
                row.insertCell(-1) // Answer.
                row.insertCell(-1) // Correct answer button.
                row.insertCell(-1) // Wrong answer button.
            }

            if (!answers.has(teamId)) {
                // No answer to the question for this team.
                var answerText = ''
            } else {
                var answerText = answers.get(teamId).answer
            }

            // TODO: make it a function 
            if (row.cells[0].textContent != team.name) {
                row.cells[0].textContent = team.name
            }

            // TODO: make it a function
            if (row.cells[1].textContent != answerText) {
                row.cells[1].textContent = answerText
            }
        }
    }

    updateQuiz(updates) {
        if (updates.status) {
            // TODO: what if the quiz id has changed?
            // TODO: what if the number of questions has changed?
            currentStatus = updates.status
            console.log('Status update received.')
            updateStatusTable(updates.status)
        }

        // Update teams index.
        for (const team of updates.teams) {
            lastSeenTeamsUpdateId = Math.max(lastSeenTeamsUpdateId, team.update_id)
            teamsIndex.set(team.id, team)
            console.log('Team update received. Name: "' + team.name + '". Id: ' + team.id)
        }

        // Update answers index.
        for (const answer of updates.answers) {
            lastSeenAnswersUpdateId = Math.max(lastSeenAnswersUpdateId, answer.update_id)
            if (!answersIndex.has(answer.question)) {
                answersIndex.set(answer.question, new Map())
            }
            answersIndex.get(answer.question).set(answer.team_id, answer)
            console.log('Answer update received. Question: ' + answer.question + '. Team Id: ' + answer.team_id + '. Answer: "' + answer.answer + '"')
        }

        updateResultsTable()
        updateAnswersTable(document, teamsIndex, answersIndex, document)
    }

    getUpdates() {
        sendCommand('getUpdates', {
            'min_status_update_id': currentStatus.update_id + 1,
            'min_teams_update_id': lastSeenTeamsUpdateId + 1,
            'min_answers_update_id': lastSeenAnswersUpdateId + 1,
        }).then((updates) => {
            controller.update(updates)
        })
        // .catch((error) => {
        //     console.error('Could not get updates: ' + error)
        // })
    }

    listenToServer() {
        setInterval(this.getUpdates, 1000)
    }
}

/*
function updateTextContent(element, newTextContent) {
    if (element.textContent != newTextContent) {
        element.textContent = newTextContent
    }
}
*/

var controller = null

function onLoad() {
    const controller = new QuizController(document)
    controller.listenToServer()
}

if (typeof window === 'undefined') {
    module.exports = {
        QuizController: QuizController,
        //updateAnswersTable: updateAnswersTable,
    }
}
