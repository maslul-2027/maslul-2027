'use strict';

const FORM_FIELDS = [
  { id: 'full_name', title: 'שם מלא', required: true },
  { id: 'enlistment_date', title: 'תאריך גיוס (YYYY-MM-DD)', required: true },
  { id: 'pakal', title: 'פק״ל', required: false },
];

const API_ROOT = 'https://forms.googleapis.com/v1/forms';

function createProvider(request) {
  async function create(title) {
    const form = await request({ url: API_ROOT, method: 'POST', body: { info: { title } } });
    return form.formId;
  }

  async function configure(formId) {
    const url = API_ROOT + '/' + encodeURIComponent(formId);
    const existing = await request({ url, method: 'GET' });
    const items = existing.items || [];
    const matchesTemplate = items.length === FORM_FIELDS.length && FORM_FIELDS.every((field, index) => {
      const item = items[index];
      const question = item.questionItem?.question;
      return item.title === field.title && question?.textQuestion &&
        Boolean(question.required) === field.required && question.questionId;
    });
    if (!matchesTemplate && items.length) throw new Error('Google Form contains an unexpected question layout');

    if (!matchesTemplate) {
      const requests = FORM_FIELDS.map((field, index) => ({
        createItem: {
          item: {
            title: field.title,
            questionItem: { question: { required: field.required, textQuestion: {} } },
          },
          location: { index },
        },
      }));
      await request({
        url: url + ':batchUpdate',
        method: 'POST',
        body: { requests, writeControl: { requiredRevisionId: existing.revisionId } },
      });
    }
    const form = matchesTemplate ? existing : await request({ url, method: 'GET' });
    const questionIds = Object.fromEntries(FORM_FIELDS.map((field, index) => [
      field.id, form.items[index].questionItem.question.questionId,
    ]));
    return { formId, questionIds };
  }

  return { create, configure };
}

module.exports = { createProvider };
