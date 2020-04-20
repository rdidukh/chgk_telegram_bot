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
const teamsIndex = new Map() // team_id --> Team
const answersIndex = new Map() // question --> team_id --> Answer
var currentAnswersTableQuestion = 1


function updateTextContent(elementId, newTextContent) {
    const element = document.getElementById(elementId)
    if (element.textContent != newTextContent) {
        element.textContent = newTextContent
    }
}

function handleUpdates(updates) {
    const status = updates.status
    if (status) {
        lastSeenStatusUpdateId = status.update_id
        currentStatus = status
        updateTextContent('status_quiz_cell', status.quiz_id)
        updateTextContent('status_language_cell', status.language)
        updateTextContent('status_question_cell', status.question)
        updateTextContent('status_registration_cell', status.registration.toString())
        updateTextContent('status_last_changed_cell', status.time)
    }

    // Update teams index.
    for (const team of updates.teams) {
        lastSeenTeamsUpdateId = Math.max(lastSeenTeamsUpdateId, team.update_id)
        teamsIndex.set(team.id, team)
    }

    // Update answers index.
    for (const answer of updates.answers) {
        lastSeenAnswersUpdateId = Math.max(lastSeenAnswersUpdateId, answer.update_id)
        if (!answersIndex.has(answer.question)) {
            answersIndex.set(answer.question, new Map())
        }

        answersIndex.get(answer.question).set(answer.team_id, answer)
    }

    // TODO: what if the quiz id has changed?
    // TODO: what if the number of questions has changed?

    // Create the first row of the results table if it does not exist yet.
    const resultsTable = document.getElementById('results_table')
    if (resultsTable.rows.length == 0) {
        const resultsTableHeaderRow = resultsTable.insertRow(0)
        resultsTableHeaderRow.insertCell(-1)
        resultsTableHeaderRow.insertCell(-1).textContent = 'Total'
        for (let q = 1; q <= currentStatus.number_of_questions; q++) {
            resultsTableHeaderRow.insertCell(-1).textContent = q
        }
    }

    // Update team names in the results table.
    // TODO: Take only new teams/answers into account.
    // TODO: iterate through new team updates only?
    for (const team of updates.teams) {
        const resultsTeamRowId = 'results_team_' + team.id + '_row'
        var resultsTeamRow = document.getElementById(resultsTeamRowId)
        if (!resultsTeamRow) {
            resultsTeamRow = resultsTable.insertRow(-1)
            resultsTeamRow.id = resultsTeamRowId

            resultsTeamRow.insertCell(-1)
            resultsTeamRow.insertCell(-1)
            for (let q = 1; q <= currentStatus.number_of_questions; q++) {
                resultsTeamRow.insertCell(-1).textContent = '0'
            }
        }
        // TODO: make it a function.
        if (resultsTeamRow.cells[0].textContent != team.name) {
            resultsTeamRow.cells[0].textContent = team.name
        }
    }

    // Update team names in the answers table.
    const answersTable = document.getElementById('answers_table')
    for (const team of updates.teams) {
        const answersTeamRowId = 'answers_team_' + team.id + '_row'
        var answersTeamRow = document.getElementById(answersTeamRowId)
        if (!answersTeamRow) {
            answersTeamRow = answersTable.insertRow(-1)
            answersTeamRow.id = answersTeamRowId
            answersTeamRow.insertCell(-1).textContent = team.name
            answersTeamRow.insertCell(-1)
            answersTeamRow.insertCell(-1)
            answersTeamRow.insertCell(-1)
        }
        if (answersTeamRow.cells[0].textContent != team.name) {
            answersTeamRow.cells[0].textContent = team.name
        }
    }



    /*
    <table id='asnwers_table'>
        <tr id='answers_team_<team_id>_row'>
            <td>Team Name</td>
            <td>Answer</td>
            <td><button>Correct</button></td>
            <td><button>Incorrect</incorrect></td>
        </tr>
    </table>
    */
}

function getUpdates() {
    sendCommand('getUpdates', {
        'min_status_update_id': lastSeenStatusUpdateId + 1,
        'min_teams_update_id': lastSeenTeamsUpdateId + 1,
        'min_answers_update_id': lastSeenAnswersUpdateId + 1,
    }).then((updates) => {
        handleUpdates(updates)
    })
    // .catch((error) => {
    //     console.error('Could not get updates: ' + error)
    // })
}

function onLoad() {
    setInterval(getUpdates, 1000)
}
