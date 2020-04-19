const enabledButtonColor = '#66ff66'

function addTableRow(table, values) {
    var tr = document.createElement('tr')
    for (i in values) {
        value = values[i]

        if (value instanceof HTMLElement) {
            tr.appendChild(document.createElement('td')).appendChild(value)
        } else {
            tr.appendChild(document.createElement('td')).innerHTML = value
        }
    }
    table.appendChild(tr)
}

function updateStatusTable(status) {
    var table = document.getElementById('status')
    table.innerHTML = ''
    addTableRow(table, ["OK", status.ok])
    addTableRow(table, ["Quiz", status.quiz_id])
    addTableRow(table, ["Question", status.question_id])
    addTableRow(table, ["Registration", status.is_registration])
    addTableRow(table, ["Language", status.language])
    addTableRow(table, ["Last updated", new Date()])
}

function updateTeamsTable(status) {
    var table = document.getElementById('teams')
    table.innerHTML = ''
    for (chat_id in status.teams) {
        addTableRow(table, [status.teams[chat_id], chat_id])
    }
}

function updateAnswersTable(status) {
    var table = document.getElementById('answers')
    table.innerHTML = ''
    team_ids = Object.keys(status.teams);
    teams_array = team_ids.map(function (id) {
        return status.teams[id]
    })

    question_set = status.question_set.sort()
    addTableRow(table, ['', ''].concat(teams_array))
    for (const i in question_set) {
        let question_id = question_set[i];
        answers = team_ids.map(function (id) {
            if (question_id in status.answers && id in status.answers[question_id]) {
                return status.answers[question_id][id]
            } else {
                return ''
            }
        })

        startButton = document.createElement('button')
        startButton.innerHTML = 'Start'
        if (!status.is_registration && !status.question_id) {
            startButton.style.backgroundColor = enabledButtonColor
        }
        startButton.style.border = '1px solid black'
        startButton.onclick = () => {
            sendCommand("startQuestion", { "question_id": question_id }).then((response) => {
                console.log("Question '" + question_id + "' started!")
            }).catch((error) => {
                console.warn("Could not start question: " + error)
            });
        }

        addTableRow(table, [startButton, question_id].concat(answers))
    }
}

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

function getStatus() {
    sendCommand('getStatus', {}).then((response) => {
        updateStatusTable(response)
        updateTeamsTable(response)
        updateAnswersTable(response)

        startRegistrationButton = document.getElementById("start_registration_button")
        stopRegistrationButton = document.getElementById("stop_registration_button")
        stopQuestionButton = document.getElementById("stop_question_button")

        if (response.is_registration) {
            startRegistrationButton.style.backgroundColor = null
            stopRegistrationButton.style.backgroundColor = enabledButtonColor
            stopQuestionButton.style.backgroundColor = null
        } else if (response.question_id) {
            startRegistrationButton.style.backgroundColor = null
            stopRegistrationButton.style.backgroundColor = null
            stopQuestionButton.style.backgroundColor = enabledButtonColor
        } else {
            startRegistrationButton.style.backgroundColor = enabledButtonColor
            stopRegistrationButton.style.backgroundColor = null
            stopQuestionButton.style.backgroundColor = null
        }
    }).catch((error) => {
        console.log("Could not get status: " + error)
    });
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

var lastSeenStatusUpdateId = 0
var lastSeenTeamsUpdateId = 0
var lastSeenAnswersUpdateId = 0
var currentStatus = null
var currentAnswers = null

/*
        <tr>
            <td>Quiz</td>
            <td id='status_quiz_cell'></td>
        </tr>
        <tr>
            <td>Language</td>
            <td id='status_language_cell'></td>
        </tr>
        <tr>
            <td>Question</td>
            <td id='status_question_cell'></td>
        </tr>
        <tr>
            <td>Registration</td>
            <td id='status_registration_cell'></td>
        </tr>
        <tr>
            <td>Last changed</td>
            <td id='status_last_changed_cell'></td>
        </tr>
*/

function updateTextContent(elementId, newTextContent) {
    const element = document.getElementById(elementId)
    if (element.textContent != newTextContent) {
        element.textContent = newTextContent
    }
}

function handle {
}

function handleStatusUpdate(status) {
    updateTextContent('status_quiz_cell', status.quiz_id)
    updateTextContent('status_language_cell', status.language)
    updateTextContent('status_question_cell', status.question)
    updateTextContent('status_registration_cell', status.registration.toString())
    updateTextContent('status_last_changed_cell', status.time)
}

function handleUpdates(updates) {
    if (updates.status) {
        lastSeenStatusUpdateId = updates.status.update_id
        currentStatus = updates.status
        handleStatusUpdate(updates.status)
    }

    for (const team of updates.teams) {
        lastSeenTeamsUpdateId = Math.max(lastSeenTeamsUpdateId, team.update_id)
        // TODO: update team index.
        // team_id --> Team
    }

    for (const answer of updates.answers) {
        lastSeenAnswersUpdateId = Math.max(lastSeenAnswersUpdateId, answer.update_id)
        // TODO: update answers index.
        // question --> team_id --> Answer
    }

    // TODO: update answers table.
    for (team_id in teams) {

    }
}

function getUpdates() {
    sendCommand('getUpdates', {
        'min_status_update_id': lastSeenStatusUpdateId + 1,
        'min_teams_update_id': lastSeenTeamsUpdateId + 1,
        'min_answers_update_id': lastSeenAnswersUpdateId + 1,
    }).then((updates) => {
        handleUpdates(updates)
    }).catch((error) => {
        console.error('Could not get updates: ' + error)
    })
}

function onLoad() {
    setInterval(getUpdates, 1000)
}
