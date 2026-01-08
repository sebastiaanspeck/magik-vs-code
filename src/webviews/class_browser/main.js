'use strict';

// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.

/* eslint-disable */
(function main() {
  const vscode = acquireVsCodeApi();

  const methodInput = document.querySelector('#methodInput');
  const classInput = document.querySelector('#classInput');
  const localButton = document.querySelector('#localButton')
  const argsButton = document.querySelector('#argsButton')
  const commentsButton = document.querySelector('#commentsButton')
  const resultsCounter = document.querySelector('.results-length')
  const resultsList = document.querySelector('.results-list')

  const textfields = [methodInput, classInput]
  const buttons = [localButton, argsButton, commentsButton]

  let navigationElements = [];
  let selectedElement;

  textfields.forEach(textfield => {
    textfield.addEventListener('input', debounce(() => {
      vscode.postMessage({
        type: 'textfield',
        name: textfield.name,
        value: textfield.value
      });
    }, 400));
  })

  buttons.forEach(button => {
    button.addEventListener('click', () => {
      vscode.postMessage({
        type: 'button',
        name: button.name
      })
    })
  })

  document.onkeydown = (e) => {
    const elementsLength = navigationElements.length;
    const activeElement = document.activeElement;
    let newIndex;
    switch (e.key) {
      case 'Tab': 
        if (activeElement === classInput) {
          methodInput.focus()
          e.preventDefault()
        }
        else if (activeElement === methodInput) {
          classInput.focus()
          e.preventDefault()
        }
        break
      case '/':
        if (activeElement === classInput || activeElement === methodInput) {
          vscode.postMessage({
            type: 'textfield',
            name: activeElement.name,
            value: ''
          })
          e.preventDefault()
        }
        break
    }

    if (elementsLength === 0) {
      selectedElement = undefined;
    } else if (newIndex !== undefined) {
      selectedElement = navigationElements[newIndex];
      selectedElement.focus();
      return false;
    }
  };

  // Handle messages sent from the extension to the webview
  window.addEventListener('message', event => {
    const message = event.data; // The json data that the extension sent
    switch (message.type) {
      case 'updateTextfield': 
        setTextfield(message.name, message.value)
        break
      case 'updateButton': 
        setButton(message.name, message.selected)
        break
      case 'updateResults':
        updateResultList(message.results, message.resultsLength);
        break;
      case 'clearResults':
        clearResultList();
        break;
      case 'enableSearch':
        enableSearch(message.enabled);
        break;
      case 'focus':
        if (classInput.classList.contains('disabled')) {
          break
        }
        const selectedInput = message.input === 'method' ? methodInput : classInput
        selectedInput.focus();
        selectedInput.setSelectionRange(0, selectedInput.value.length);
        break;
      case 'search':
        search(message);
        break;
      default:
    }
  });

  function setTextfield(name, value) {
    const textfield = textfields.find(textfield => textfield.name == name)
    textfield.value = value
  }

  function setButton(name, selected) {
    const button = buttons.find(button => button.name === name)
    if (selected) {
      button.classList.add('selected');
    } else {
      button.classList.remove('selected');
    }
  }

  function clearResultList() {
    resultsList.textContent = '';
    resultsCounter.textContent = '';
    navigationElements = []
    selectedElement = undefined;
  }

  function addText(parent, text, className) {
    const span = document.createElement('span');
    if (className) {
      span.className = className;
    }
    span.appendChild(document.createTextNode(text));
    parent.appendChild(span);
  }

  function updateResultList(results, resultsLength) {
    const methodsLength = results.length;
    const navElements = [];

    if (resultsLength !== undefined) {
      resultsCounter.textContent = `${resultsLength} results found`;
    }

    for (let methodIndex = 0; methodIndex < methodsLength; methodIndex++) {
      const methodData = results[methodIndex];

      if (methodData.methodName) {
        const methodElement = document.createElement('li');
        methodElement.className = 'method-element';
        methodElement.setAttribute('tabindex', 0);
        methodElement.setAttribute('data-class-name', methodData.className);
        methodElement.setAttribute('data-method-name', methodData.methodName);
        methodElement.setAttribute('data-package-name', methodData.package);

        const img = document.createElement('div')
        if (methodData.className) {
          img.classList.add('codicon', 'codicon-symbol-method');
        } else {
          img.classList.add('codicon', 'codicon-symbol-constant');
        }
        if (methodData.level === 'Basic') {
          img.classList.add('basic');
        }
        methodElement.appendChild(img);

        addText(methodElement, `${methodData.package}\u2004:\u2004`);

        if (methodData.className) {
          addText(methodElement, methodData.className, 'class-entry');
          addText(methodElement, '\u2004.\u2004');
        }

        addText(methodElement, methodData.methodName, 'method-entry');

        addText(methodElement, methodData.infoString, 'info-entry');

        addText(methodElement, methodData.topics.join('\u2002\u2004'), 'topics-entry');

        methodElement.addEventListener('click', () => {
          handleMethodClicked(methodData.className, methodData.methodName, methodData.package);
        });

        resultsList.appendChild(methodElement);

        navElements.push(methodElement);
      }

      const commentLines = methodData.commentLines
      const commentsLength = commentLines.length;
      if (methodData.argsString || commentsLength > 0) {
        const ul = document.createElement('ul');
        ul.className = 'info-list';

        if (methodData.argsString) {
          const argElement = document.createElement('li');
          argElement.className = 'args-element';
          const str = methodData.argsString.trim().replace(/\s+/g, '\u2002\u2004');
          const argsText = document.createTextNode(str);
          argElement.appendChild(argsText);
          ul.appendChild(argElement);
        }

        if (commentsLength > 0) {
          let endIndex = 0;
          for (let lineIndex = commentsLength - 1; lineIndex > -1; lineIndex--) {
            const line = commentLines[lineIndex];
            const commentParts = line.split('##');
            const str = commentParts[commentParts.length - 1];

            if (str.trim().length !== 0) {
              endIndex = lineIndex;
              break;
            }
          }

          let checkEmpty = true;
          for (let lineIndex = 0; lineIndex < endIndex + 1; lineIndex++) {
            const line = commentLines[lineIndex];
            const commentParts = line.split('##');
            let str = commentParts[commentParts.length - 1];

            if (str.trim().length === 0) {
              if (checkEmpty) {
                continue;
              }
              str = '\u2002';
            }
            checkEmpty = false;

            str = str.replace(/\s/gy, '\u2002');

            const commentElement = document.createElement('li');
            commentElement.className = 'comment-element';
            const commentText = document.createTextNode(str);
            commentElement.appendChild(commentText);
            ul.appendChild(commentElement);
          }
        }

        resultsList.appendChild(ul);
      }
    }

    navigationElements = navElements;
    selectedElement = undefined;
  }

  function enableSearch(enabled) {
    methodInput.disabled = !enabled;
    classInput.disabled = !enabled;
    localButton.disabled = !enabled;
    argsButton.disabled = !enabled;
    commentsButton.disabled = !enabled;
  }

  function debounce(callback, wait) {
    let timeout;
    return (...args) => {
      const context = this;
      clearTimeout(timeout);
      timeout = setTimeout(() => callback.apply(context, args), wait);
    };
  }

  function handleMethodClicked(className, methodName, packageName) {
    vscode.postMessage({type: 'methodSelected', className, methodName, packageName,});
  }

  vscode.postMessage({type: 'ready'});
}());
