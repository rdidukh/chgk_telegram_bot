const index = require('./static/index.js')
const assert = require('assert');
const jsdom = require("jsdom");

describe('InitTest', function () {
    it('#initsResultsTable', function () {
        const dom = new jsdom.JSDOM(`<html><body><table id="results_table"></table></body></html>`);
        const document = dom.window.document

        const controller = new index.QuizController(document, 3)
        controller.init()


        const table = document.getElementById('results_table')
        assert.equal(table.rows.length, 3)
        assert.equal(table.rows[0].cells.length, 5)
        assert.equal(table.rows[1].cells.length, 5)
        assert.equal(table.rows[2].cells.length, 5)

        assert.equal(table.rows[0].cells[1].textContent, 'Total')
        assert.equal(table.rows[0].cells[2].textContent, '1')
        assert.equal(table.rows[0].cells[3].textContent, '2')
        assert.equal(table.rows[0].cells[4].textContent, '3')

        for (var q = 1; q <= 3; q++) {
            const startButton = table.rows[1].cells[q + 1].firstChild
            assert.equal(startButton.tagName, 'BUTTON')
            assert.equal(startButton.textContent, '>')
        }
    });
});

describe('ShowAnswersForQuestionTest', function () {
    it('#overwritesValues', function () {
        const dom = new jsdom.JSDOM(`<html><body><table id="answers_table"></table></body></html>`);
        const document = dom.window.document

        const table = document.getElementById('answers_table')
        table.insertRow(-1).id = 'answers_team_5001_row'
        table.insertRow(-1).id = 'answers_team_5002_row'
        for (var i = 0; i < 4; i++) {
            table.rows[0].insertCell(-1)
            table.rows[1].insertCell(-1)
        }
        table.rows[0].cells[0] = 'REMOVE'
        table.rows[0].cells[1] = 'REMOVE'
        table.rows[1].cells[0] = 'REMOVE'
        table.rows[1].cells[1] = 'REMOVE'

        const controller = new index.QuizController(document)

        controller.teamsIndex = new Map([
            // TODO: more teams.
            [5001, { name: 'Austria' }],
            [5002, { name: 'Belgium' }],
        ])
        controller.answersIndex = new Map([
            [3, new Map([
                [5001, { answer: 'Apple' }],
                // No answer for team Belgium.
            ])],
        ])

        controller.showAnswersForQuestion(3)

        assert.equal(controller.currentQuestion, 3)

        assert.equal(table.rows.length, 2)
        assert.equal(table.rows[0].cells.length, 4)
        assert.equal(table.rows[1].cells.length, 4)

        assert.equal(table.rows[0].cells[0].textContent, 'Austria')
        assert.equal(table.rows[0].cells[1].textContent, 'Apple')
        assert.equal(table.rows[1].cells[0].textContent, 'Belgium')
        assert.equal(table.rows[1].cells[1].textContent, '')
    });

    it('#emptyAnswersIndex', function () {
        const dom = new jsdom.JSDOM(`<html><body><table id="answers_table"></table></body></html>`);
        const document = dom.window.document

        const table = document.getElementById('answers_table')
        table.insertRow(-1).id = 'answers_team_5001_row'
        table.insertRow(-1).id = 'answers_team_5002_row'
        for (var i = 0; i < 4; i++) {
            table.rows[0].insertCell(-1)
            table.rows[1].insertCell(-1)
        }
        table.rows[0].cells[0] = 'REMOVE'
        table.rows[0].cells[1] = 'REMOVE'
        table.rows[1].cells[0] = 'REMOVE'
        table.rows[1].cells[1] = 'REMOVE'

        const controller = new index.QuizController(document)

        controller.teamsIndex = new Map([
            [5001, { name: 'Austria' }],
            [5002, { name: 'Belgium' }],
        ])
        controller.answersIndex = new Map()

        controller.showAnswersForQuestion(2)

        assert.equal(table.rows.length, 2)
        assert.equal(table.rows[0].cells.length, 4)
        assert.equal(table.rows[1].cells.length, 4)

        assert.equal(table.rows[0].cells[0].textContent, 'Austria')
        assert.equal(table.rows[0].cells[1].textContent, '')
        assert.equal(table.rows[1].cells[0].textContent, 'Belgium')
        assert.equal(table.rows[1].cells[1].textContent, '')
    });

    it('#addsNewRows', function () {
        const dom = new jsdom.JSDOM('<html><body><table id="answers_table"></table></body></html>');
        const document = dom.window.document

        const controller = new index.QuizController(document)

        controller.teamsIndex = new Map([
            [5001, { name: 'Austria' }],
            [5002, { name: 'Belgium' }],
        ])
        controller.answersIndex = new Map([
            [4, new Map([
                [5001, { answer: 'Apple' }],
                [5002, { answer: 'Banana' }]
            ])],
        ])
        controller.showAnswersForQuestion(4)

        const table = document.getElementById('answers_table')
        assert.equal(table.rows.length, 2)
        assert.equal(table.rows[0].cells.length, 4)
        assert.equal(table.rows[1].cells.length, 4)

        const austriaRow = table.querySelector('#answers_team_5001_row')
        assert.equal(austriaRow.cells[0].textContent, 'Austria')
        assert.equal(austriaRow.cells[1].textContent, 'Apple')

        const belgiumRow = table.querySelector('#answers_team_5002_row')
        assert.equal(belgiumRow.cells[0].textContent, 'Belgium')
        assert.equal(belgiumRow.cells[1].textContent, 'Banana')
    });
});
