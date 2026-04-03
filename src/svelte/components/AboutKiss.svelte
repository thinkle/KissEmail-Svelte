<script lang="ts">
  import { TextLayout } from "contain-css-svelte";
  let {
    onEditTemplate,
  }: {
    onEditTemplate: () => {};
  } = $props();
</script>

<TextLayout>
  <h2>About KISS Mail Merge</h2>
  <p>
    KISS (Keep It Simple, Stupid) Mail Merge is meant to keep mail merge as
    <i>simple</i> as possible.
  </p>
  <b>No Limits beyond Google's, no subscription or fees, <u>ever</u>.</b>
  <h3>The Basics</h3>
  <ol>
    <li>
      Set up your data sheet with a column for each field you want to insert
      into your email.
    </li>
    <li>Add one row per email you want to send.</li>
    <li>
      <a href="#" onclick={onEditTemplate}>Write a message template</a>,
      inserting column data as fields (fields are inserted as column names, like
      this: {"{{"}Email{"}}"}).
    </li>
    <li>Send your emails.</li>
  </ol>
  <p>
    The configuration is saved automatically as <i
      >another sheet in your email</i
    >, so you can always see what's under the hood and edit it directly if you
    want.
  </p>
  <h3>Bells &amp; Whistles</h3>
  <dl>
    <dt>Receipt tracking</dt>
    <dd>
      See when your emails are opened(*), right from your spreadsheet. You can
      even have it automatically check every hour for you.

      <br /><small
        >(*)Like all receipt tracking, this works by including a tiny invisible
        image in your email and tracking when it is opened, so it may not be
        100% accurate since some email clients block images and some may
        pre-fetch them before opening. But in general it should give you a good
        sense of when your emails are being opened. We do not send any data
        about your email to our image server: the only connection is a random ID
        that is stored in your spreadsheet.</small
      >
    </dd>
    <dt>Only send certain rows</dt>
    <dd>You can use conditional logic to control which rows are sent.</dd>
    <dt>Prefer Editing in Email?</dt>
    <dd>We support importing a template from your draft folder</dd>
  </dl>

  <h3>More Complex Needs?</h3>
  <p>
    Most “advanced” mail merge features belong in the spreadsheet, not in the
    mail merge tool. Building them in here would be like bolting a pocket
    calculator onto a supercomputer. Google Sheets is already the power tool:
    it can calculate, transform, filter, and generate exactly the data you
    want. KISS Mail Merge should stay focused on one job: turning that prepared
    data into email.
  </p>
  <p>
    So when your needs get more complex, the usual answer is helper columns,
    formulas, and generated HTML in the sheet itself. Want different paragraphs
    for different recipients? Generate them in a column. Want complex sending
    rules? Compute them in the sheet. If you get stuck, ask an LLM for a
    formula or sheet layout. As long as it understands that the end result is
    spreadsheet columns feeding an HTML email template, you’ll be in good
    shape.
  </p>
</TextLayout>

<style>
  dt {
    font-weight: bold;
    color: var(--primary-bg);
  }
  dd {
    margin-left: 1em;
  }
  dl {
    display: grid;
    gap: 0.75rem;
    margin: 0;
  }

  dt {
    position: relative;
    margin: 0;
    padding-left: 1.25rem;
    font-weight: 700;
    color: var(--material-color-purple-800);
  }

  dt::before {
    content: "✦";
    position: absolute;
    left: 0;
    top: 0;
    color: var(--material-color-pink-500);
    font-size: 0.9em;
  }

  dd {
    margin: 0 0 0 1.25rem;
    color: var(--fg);
    opacity: 0.9;
  }

  dd small {
    display: block;
    margin-top: 0.25rem;
    opacity: 0.7;
  }
</style>
