
### interactive-mode (https://code.claude.com/docs/en/interactive-mode)
- The cleaned prompt goes back into the input box with a notice such as Removed 3 invisible characters · review and press Enter to send , and pressing Enter again sends the text as shown.
- If the cleaned prompt would begin with / , Claude Code puts it in the input box for you to review and send instead.
- ​ Vim editor mode 
 Enable vim-style editing via /config → Editor mode.
- Claude Code keeps your vim mode and cursor position when you toggle the transcript viewer with Ctrl+O or open and close a panel such as /config .
- json example turns on vim mode and maps jj to Escape: 
 { 
 "editorMode" : "vim" , 
 "vimInsertModeRemaps" : { "jj" : "<Esc>" } 
 } 
 Each key is exactly two printable characters typed in sequence, and "<Esc>" is the only supported target.
- The empty search prompt shows a hint: press Esc then i then / to open the command menu instead 
 In vim NORMAL mode, if the cursor is at the beginning or end of input and can’t move further, j / k and ↑ / ↓ navigate command history instead.
- ​ Theme and display 
 Shortcut Description Context Ctrl+T Toggle syntax highlighting for code blocks Only works inside the /theme picker menu.
- Claude Code uses your theme’s error color by default and for any value it doesn’t recognize.
- Controls whether code in Claude’s responses uses syntax coloring 
 ​ Multiline input 
 Method Shortcut Context Quick escape \ + Enter Works in all terminals Option key Option+Enter After enabling Option as Meta on macOS Shift+Enter Shift+Enter Native in iTerm2, WezTerm, Ghostty, Kitty, Warp, Apple Terminal, Windows Terminal.
- To choose which of the three programs Claude Code runs, which dictionary it uses, or the underline color, add any of these fields next to enabled , in the same place: 
 checker : aspell , hunspell , or ispell .
- color : a color name such as yellow , or a #rrggbb , #rgb , rgb(r,g,b) , ansi256(n) , or ansi:<name> value.
- json , in the file you pass to --settings , and in managed settings: 
 { 
 "spellcheck" : { 
 "enabled" : true , 
 "checker" : "hunspell" , 
 "language" : "en_GB" , 
 "color" : "yellow" 
 } 
 } 
 If more than one of the three places has a spellcheck setting, Claude Code uses only one of them: managed settings first, then --settings , then user settings.
- The link has a colored underline indicating the review state: 
 Green: approved 
 Yellow: pending review 
 Red: changes requested 
 Gray: draft 
 The badge disappears once the pull request merges or closes.
- The colored underline shows the merge request’s state: 
 Green: GitLab reports the merge request as mergeable 
 Yellow: any other open state 
 Gray: draft 
 The badge disappears once the merge request merges or closes.
- See add a comment when you answer a permission prompt Up/Down arrows or Ctrl+P / Ctrl+N Move cursor or navigate command history When the input spans more than one visual row, whether wrapped or multiline, first moves the cursor within the prompt.
- Repeat to clear across lines in multiline input.
- Suspends the process to your shell; run fg to resume Left/Right arrows Cycle through dialog tabs Navigate between tabs in permission dialogs and menus Tab Accept an autocomplete suggestion, or add a comment to a permission answer While autocomplete suggestions are showing in the prompt input, accepts the selected suggestion.
- Turn on Show last response in external editor in /config to prepend Claude’s previous reply as # -commented context above your prompt; Claude Code strips the comment block when you save Ctrl+L Redraw the screen Forces a full terminal redraw, keeping input and conversation history.
- Once the cursor is on the first or last visual row, pressing again navigates command history.
- On a permission prompt, Esc declines the action, the same as No without a comment Esc + Esc Clear input draft, or rewind When the prompt input contains text, double Esc clears it and saves the draft to history so Up recalls it.
- To delete only the previous word, press Option+Delete on macOS or Ctrl+Backspace on Windows Ctrl+Y Paste deleted text Pastes the text you last deleted with one of the word or line deletion shortcuts, such as Ctrl+K , Ctrl+U , or Ctrl+W Alt+Y (after Ctrl+Y ) Cycle paste history After pasting, cycle through previously deleted text.
- ​ Command history 
 Claude Code keeps a history of the prompts you type, and Up-arrow recall reaches prompts from past sessions of the same project: 
 Input history is stored per working directory 
 Running /clear starts a new session: recall then lists the new session’s prompts first, with earlier sessions’ prompts after them.
- Submitting the same prompt twice in a row records one history entry, so pressing Up steps to the previous distinct prompt 
 When you recall a prompt that included pasted text, Claude Code sends the full pasted content again when you resubmit.
- If the content has since been cleaned up , Claude Code doesn’t send the literal [Pasted text #N] string; see Paste large content for what happens to the prompt 
 History expansion with ! is disabled by default 
 ​ Reverse search with Ctrl+R 
 Press Ctrl+R to interactively search through your command history.
- The steps below describe the classic renderer’s inline search: 
 Start search : press Ctrl+R to activate reverse history search 
 Type query : enter text to search for in previous commands.
- The fullscreen dialog searches your whole prompt history in the selected scope, newest first, with duplicates collapsed to the newest occurrence: the most recent prompts appear immediately, and matches from older prompts fill in as Claude Code loads the rest.
- Accepting a match or canceling the search takes effect immediately, even while Claude Code is still loading the history.
- It picks this from your project’s git history, so the example reflects files you’ve been working on recently.
- After Claude responds, Claude Code can suggest your next prompt based on your conversation history, such as a follow-up step from a multi-part request or a natural continuation of your workflow.
- It also checks nothing while the input box is in shell mode , Ctrl+R history search, or voice dictation .
- ​ Side questions with /btw 
 Use /btw to ask a question about your current work without adding to the conversation history.
- The question and answer never enter the conversation history.
- They stay out of the conversation history.
- While you have messages queued, Up from the first row instead takes them back Esc Interrupt Claude, or close a dialog Stop the current response or tool call mid-turn so you can redirect.
- When a dialog is open, Esc closes the dialog.
- When the input is empty, double Esc opens the rewind menu to restore or summarize code and conversation from a previous point Ctrl+Enter or Ctrl+X Ctrl+S Send queued messages now Interrupts the current turn so your queued messages , and your draft with them, go out right away instead of when the turn ends.
- Requires fullscreen rendering q , Ctrl+C , Esc Exit transcript view.
- ​ Mode switching 
 Command Action From mode Esc or Ctrl+[ Enter NORMAL mode.
- Press Enter or Tab to place a match in the prompt input, or Esc to cancel.
- Press Esc to interrupt the turn without submitting your draft.
- Esc : return from a file’s diff to the list, or close the viewer from the list.
- While Claude Code waits, a line at the bottom of the session shows when it will continue: 
 Usage limit reached · continuing automatically at 3:45pm · esc to cancel 
 Keep the session open.
- ​ Cancel the wait 
 Press Esc at an empty prompt, or Ctrl+C , while the line shows, or run /rate-limit-options and pick Don’t continue automatically .
- ​ Queue messages while Claude works 
 Type a message and press Enter while Claude is working.
- Claude Code queues the message instead of interrupting the turn, and lists the queued entries above the input box until it sends them.
- Sent and queued messages show in gray until Claude starts responding to them, so you can tell which messages Claude hasn’t started on yet.
- Messages: if you queue a message while Claude is running tool calls, Claude Code passes it to Claude as soon as those tool calls finish, within the same turn.
- Claude Code interrupts the turn, and your queued messages go out right away, with your draft queued behind them if you had typed one.
- If your current model doesn’t support fast mode, turning it on also switches your model , and Claude Code uses the new model from its next request in that turn 
 ​ Take back what you queued 
 Press Up from the first line of the input box to take back the queued messages and commands.
- Claude Code also skips individual suggestions in several situations, including: 
 The prompt cache is cold, to avoid unnecessary cost 
 After the first turn of a conversation, in some sessions 
 The previous response ended in an error 
 While you’re in plan mode 
 Your account is close to or at its usage limit.
- Under opusplan and other model settings that run plan mode on a different model, Claude Code waits for the reset instead.
- opusplan and other model settings that run plan mode on the limited family don’t get this exception.

### cli-reference (https://code.claude.com/docs/en/cli-reference)
- 221 or later claude --autocompact 500k --ax-screen-reader Render screen-reader friendly output: flat text without decorative borders or animations.
- md, skills, plugins, hooks, MCP servers, custom commands and agents, output styles, workflows, custom themes, custom keybindings, status line and file-suggestion commands, LSP servers, and auto memory do not load.
- Managed settings policy still applies, including policy-configured hooks, status line, and file-suggestion commands; managed plugins, managed skills, managed CLAUDE.
- See plugin reference for subcommands claude plugin install code-review@claude-plugins-official claude project purge [path] Delete all local Claude Code state for a project: transcripts, task lists, debug logs, file-edit history, prompt history lines, and the project’s entry in ~/.
- The CLAUDE_CODE_SKIP_PROMPT_HISTORY environment variable does the same in any mode claude -p --no-session-persistence "query" --output-format Specify output format for print mode (options: text , json , stream-json ) claude -p "query" --output-format json --permission-mode Begin in a specified permission mode .
- ai/code URL, queue a message into that existing session instead, with -p .

### terminal-config (https://code.claude.com/docs/en/terminal-config)
- Token Controls promptBorder Input box border planMode Plan mode accent, plan messages, and plan-mode dialogs autoAccept Accept-edits mode accent bashBorder Input box border when entering a ! shell command ide IDE connection indicator fastMode Fast mode indicator effortUltra The ultracode tag on the input box border while ultracode is on.
- If the paste carries invisible Unicode characters , Claude Code removes them when you press Enter and puts the cleaned prompt back in the input box for you to send with another Enter.
- Color token reference The following example combines tokens from several of the groups below: the brand accent, the plan mode border, the diff backgrounds, and the message background.
- Token Controls success Success messages and passing checks error Error messages and failures warning Warnings, caution messages, and the auto mode indicator merged Merged pull request status ​ Input box and mode indicators Set the input box border color and the accent shown while a permission mode or indicator is active.
- claude and claudeShimmer 
 warning and warningShimmer 
 permission and permissionShimmer 
 promptBorder and promptBorderShimmer 
 inactive and inactiveShimmer 
 fastMode and fastModeShimmer 
 Each subagent and parallel task is shown in one of eight named colors so you can tell them apart in the transcript.
- Token Controls rate_limit_fill Filled portion of the usage meter rate_limit_empty Unfilled portion of the usage meter briefLabelYou Color of the You label on your messages briefLabelClaude Color of the Claude label on assistant messages ​ Shimmer variants and subagent colors Several tokens have a paired shimmer variant that supplies the lighter color used in the spinner’s animated gradient.
- To customize what appears at the bottom of the interface, configure a custom status line that shows the current model, working directory, git branch, or other context.
- Navigation Interface Configure your terminal for Claude Code Getting started Build with Claude Code Administration Configuration Reference Agent SDK What&#x27;s New Resources Interface Configure your terminal for Claude Code Copy page Copy page Fix Shift+Enter for newlines, get a terminal bell when Claude finishes, configure tmux, match the color theme, and enable Vim mode in the Claude Code CLI.
- ​ Edit prompts with Vim keybindings 
 Claude Code includes a Vim-style editing mode for the prompt input.
- Vim mode supports a subset of NORMAL- and VISUAL-mode motions and operators, such as hjkl navigation, v / V selection, and d / c / y with text objects.
- See the Vim editor mode reference for the full key table.
- To map a two-key INSERT-mode sequence such as jj to Escape, set vimInsertModeRemaps in your user settings.
- ​ Match the color theme 
 Use the /theme command, or the theme picker in /config , to choose a Claude Code theme that matches your terminal.
- Selecting the auto option detects your terminal’s light or dark background, so the theme follows OS appearance changes whenever your terminal does.
- ​ Create a custom theme 
 In addition to the built-in presets, /theme lists any custom themes you have defined and any themes contributed by installed plugins .
- Select New custom theme… at the end of the list to create one interactively: you name the theme, then pick individual color tokens to override.
- Press Ctrl+E while a custom theme is highlighted to edit it.
- Each custom theme is a JSON file in ~/.
- json extension is the theme’s slug, and selecting the theme stores custom:<slug> as your theme preference.
- The file has three optional fields: 
 Field Type Description name string Display label shown in /theme .
- Defaults to the filename slug base string Built-in preset the theme starts from: dark , light , dark-daltonized , light-daltonized , dark-ansi , or light-ansi .
- The following example defines a theme that keeps the dark preset but recolors the prompt accent, error text, and success text: 
 ~/.
- claude/themes/ and reloads when a file is added or changed, so edits made in your editor apply to a running session without a restart.
- claude/themes/ folder itself didn’t exist when Claude Code started, restart once after creating your first theme file.
- The interactive editor in /theme shows the same tokens with a live preview, plus a few single-purpose accents such as onboarding screen colors that are omitted here.
- Claude Code does not control the terminal’s own color scheme, which is set by the terminal application.
- Defaults to dark overrides object Map of color token names to color values.
- Tokens not listed here fall through to the base preset 
 Color values accept #rrggbb , #rgb , rgb(r,g,b) , ansi256(n) , or ansi:<name> where <name> is one of the 16 standard ANSI color names such as red or cyanBright .
- Unknown tokens and invalid color values are ignored, so a typo cannot break rendering.
- json { 
 "name" : "Midnight" , 
 "base" : "dark" , 
 "overrides" : { 
 "claude" : "#a78bfa" , 
 "planMode" : "#38bdf8" , 
 "diffAdded" : "#14532d" , 
 "diffRemoved" : "#7f1d1d" , 
 "userMessageBackground" : "#1e1b4b" 
 } 
 } 
 ​ Text and accent colors Control the primary brand accent and the foreground text shades used throughout the interface.
- md indicators ​ Status colors Signal success, failure, and warning states across messages and indicators.
- Your override of this color takes effect on Claude Code v2.
- 239 or later ​ Diff rendering Color added and removed code in file edits and reviews.
- The token names follow the pattern <color>_FOR_SUBAGENTS_ONLY , where <color> is red , blue , green , yellow , purple , orange , pink , or cyan .
- Override these to change what each named color looks like.
- For example, a subagent with color: blue in its definition is drawn using the blue_FOR_SUBAGENTS_ONLY value.
- Claude Code renders the ultrathink keyword in the prompt input with a seven-color rainbow gradient.
- The token names follow the pattern rainbow_<color> and rainbow_<color>_shimmer , where <color> is red , orange , yellow , green , blue , indigo , or violet .
- ​ Enter multiline prompts 
 Pressing Enter submits your message.
- claude/paste-cache/ , so when you recall a prompt from command history and resubmit it, the full pasted content is sent again, including in a later session.

### slash-common (https://code.claude.com/docs/en/slash-commands)
- sidebar {{ width: 280px; background: #252542; padding: 20px; border-right: 1px solid #3d3d5c; overflow-y: auto; flex-shrink: 0; }} 
 .
- stat {{ display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #3d3d5c; }} 
 .
- bar {{ height: 18px; border-radius: 3px; }} 
 .
- tree {{ list-style: none; padding-left: 20px; }} 
 details {{ cursor: pointer; }} 
 summary {{ padding: 4px 8px; border-radius: 4px; }} 
 summary:hover {{ background: #2d2d44; }} 
 .
- file {{ display: flex; align-items: center; padding: 4px 8px; border-radius: 4px; }} 
 .
- This example creates a codebase explorer: an interactive tree view where you can expand and collapse directories, see file sizes at a glance, and identify file types by color.
- ## What the visualization shows 
 - * *Collapsible directories** : Click folders to expand/collapse 
 - * *File sizes** : Displayed next to each file 
 - * *Colors**: Different colors for different file types 
 - * *Directory totals** : Shows aggregate size of each folder 
 Save this to ~/.
- items(), key = lambda x : - x[ 1 ])[: 8 ] 
 colors = { 
 &#x27;.
- join( 
 f &#x27;<div class="bar-row"><span class="bar-label"> { ext } </span>&#x27; 
 f &#x27;<div class="bar" style="width: { (size / total_size) * 100 } %;background: { colors.
- 5 system-ui, sans-serif; margin: 0; background: #1a1a2e; color: #eee; }} 
 .
- main {{ flex: 1; padding: 20px; overflow-y: auto; }} 
 h1 {{ margin: 0 0 10px 0; font-size: 18px; }} 
 h2 {{ margin: 20px 0 10px 0; font-size: 14px; color: #888; text-transform: uppercase; }} 
 .
- bar-label {{ width: 55px; font-size: 12px; color: #aaa; }} 
 .
- bar-pct {{ margin-left: 8px; font-size: 12px; color: #666; }} 
 .
- folder {{ color: #ffd700; }} 
 .
- size {{ color: #888; margin-left: auto; font-size: 12px; }} 
 .
- dumps(data) } ; 
 const colors = { json.
- dumps(colors) } ; 
 function fmt(b) {{ if (b < 1024) return b + &#x27; B&#x27;; if (b < 1048576) return (b/1024).
- innerHTML = `<span class="dot" style="background:$ {{ colors[node.
- The subagent doesn’t see your conversation history, so the skill’s instructions have to stand on their own.
- When the task depends on that history, fork the conversation instead of using context: fork .
- The /skills menu writes it for you: highlight a skill and press Space to cycle states, then Esc to save to .
- In auto mode , and in plan mode while the classifier reviews commands , a model that auto mode doesn’t support also isn’t used, and the session keeps its current model.

### docs-index (https://code.claude.com/docs/en/quickstart)
### INPUT RENDERING RESEARCH

#### ink-readme (200)
- [raw mode] …Ink stops writing output, stops consuming input, and restores the terminal modes the child expects (raw mode off, cursor visible, bracketed paste off, alternate screen exited, kitty keyboard protocol off). When the suspension ends, Ink reapplies its own terminal state and repaints from scratch. ##### callback Type: `Function` When a callback is …
- [alternate screen] …d restores the terminal modes the child expects (raw mode off, cursor visible, bracketed paste off, alternate screen exited, kitty keyboard protocol off). When the suspension ends, Ink reapplies its own terminal state and repaints from scratch. ##### callback Type: `Function` When a callback is provided, Ink suspends, runs the callback, and rest…
- [cursor] …sewindowsize) - [`useFocus`](#usefocusoptions) - [`useFocusManager`](#usefocusmanager) - [`useCursor`](#usecursor) - [`useAnimation`](#useanimationoptions) - [API](#api) - [Testing](#testing) - [Using React Devtools](#using-react-devtools) - [Screen Reader Support](#screen-reader-support) - [Useful Components](#useful-components) - [Useful …
- [Static] … [`<Text>`](#text) - [`<Box>`](#box) - [`<Newline>`](#newline) - [`<Spacer>`](#spacer) - [`<Static>`](#static) - [`<Transform>`](#transform) - [Hooks](#hooks) - [`useInput`](#useinputinputhandler-options) - [`usePaste`](#usepastehandler-options) - [`useApp`](#useapp) - [`useStdin`](#usestdin) - [`useStdout`](#usestdout) - [`us…
- [rerender] … when you add new items to the `items` array, changes you make to previous items will not trigger a rerender. See [examples/static](examples/static/static.tsx) for an example usage of `<Static>` component. #### items Type: `Array` Array of items of any type to render using the function you pass as a component child. #### style Type: `object` …

#### claude-code-fullscreen (200)
- [cursor] …a second press within 800ms exits. When the prompt has text, Ctrl+D deletes the character after the cursor instead Ctrl+G or Ctrl+X Ctrl+E Open in default text editor Edit your prompt or custom response in your default text editor. Ctrl+X Ctrl+E is the readline-native binding. Turn on Show last response in external editor in /config to prepend Clau…
- [input box] …de Code queues the message instead of interrupting the turn, and lists the queued entries above the input box until it sends them. You can queue ! shell commands and most commands the same way, apart from the commands, such as /status , that Claude Code runs as soon as you send them. Sent and queued messages show in gray until Claude starts respo…
- [fullscreen] …Copy page Copy page ​ Keyboard shortcuts Keyboard shortcuts may vary by platform and terminal. In fullscreen rendering , press ? in the transcript viewer to see available shortcuts there. macOS users : Option/Alt key shortcuts ( Alt+B , Alt+F , Alt+D , Alt+Y , Alt+P ) require configuring Option as Meta in your terminal. See Enable Option key shor…