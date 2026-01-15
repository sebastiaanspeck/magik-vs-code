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
  const inputs = [...textfields, ...buttons]

  let navigationElements = [];
  let selectedElement;

  textfields.forEach(textfield => {
    textfield.addEventListener('input', debounce(() => {
      vscode.postMessage({
        type: 'textfield',
        name: textfield.name,
        value: textfield.value
      });
    }, 200));
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

  window.addEventListener('message', event => {
    const message = event.data;
    switch (message.type) {
      case 'enable':
        enableSearch(message.enabled);
        break;
      case 'parameters': 
        updateSearchParameters(message.parameters)
        break
      case 'clear':
        clearResultList();
        break;
      case 'results':
        updateResultList(message.results, message.total)
        break
      case 'focus':
        focusInput(message.input)
        break;
      default:
        console.warn('Unknown message type', message)
    }
  });

  function focusInput(input) {
    if (classInput.classList.contains('disabled')) {
      return
    }
    const selectedInput = input === 'method' ? methodInput : classInput
    selectedInput.focus();
    selectedInput.setSelectionRange(0, selectedInput.value.length);
  }

  function updateSearchParameters(searchParameters) {
    console.log('params', searchParameters)
    for(const [name, value] of Object.entries(searchParameters)) {
      const input = inputs.find(input => input.name === name)
      if(!input) {
        continue
      }

      if(typeof value !== 'boolean') {
        input.value = value
        continue
      }

      if(value) {
        input.classList.add('selected')
      }
      else {
        input.classList.remove('selected')
      }

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
    resultsCounter.textContent = `${resultsLength} results found`;

    results.forEach(result => {
      const methodElement = document.createElement('li');
      methodElement.className = 'method-element';
      methodElement.setAttribute('tabindex', 0);
      methodElement.setAttribute('data-class-name', result.class);
      methodElement.setAttribute('data-method-name', result.method);
      methodElement.setAttribute('data-package-name', result.package);
  
      const typeIcon = document.createElement('div')
      typeIcon.classList.add('codicon', `codicon-symbol-${result.type}`, result.level ?? 'level-unknown')
      const tooltip = result.level ? `${result.level} ${result.type}` : result.type
      typeIcon.setAttribute('title', capitalizeFirstLetter(tooltip))
      methodElement.appendChild(typeIcon);
  
      addText(methodElement, result.package);
      addText(methodElement, '\u2004:\u2004');
      addText(methodElement, result.class, 'class-entry');
      addText(methodElement, '\u2004.\u2004');
      if(result.method.endsWith('()')) {
        addText(methodElement, result.method.slice(0, -1) + '\u2004', 'method-entry')
        
        const requiredArgs = result.arguments.required
        if(requiredArgs.length) {
          addText(methodElement, `${requiredArgs.join(', ')}\u2004`)
        }

        const optionalArgs = result.arguments.optional
        if(optionalArgs.length) {
          addText(methodElement, 'OPTIONAL', 'optional-gather')
          addText(methodElement, `\u2004${optionalArgs.join(', ')}\u2004`)
        }

        const gatherArg = result.arguments.gather
        if(gatherArg) {
          addText(methodElement, 'GATHER', 'optional-gather')
          addText(methodElement, `\u2004${gatherArg}\u2004`)
        }

        addText(methodElement, ')', 'method-entry')
      }
      else {
        addText(methodElement, result.method, 'method-entry');
      }

      if(result.isPrivate) {
        addText(methodElement, '\u2004\u2004');
        const privateIcon = document.createElement('div')
        privateIcon.classList.add('codicon', `codicon-lock`, 'modifier')
        privateIcon.setAttribute('title', 'Private')
        methodElement.appendChild(privateIcon);
      }
      
      if(result.isIterator) {
        addText(methodElement, '\u2004\u2004');
        const iteratorIcon = document.createElement('div')
        iteratorIcon.classList.add('codicon', `codicon-sync`, 'modifier')
        iteratorIcon.setAttribute('title', 'Iterator')
        methodElement.appendChild(iteratorIcon);
      }
      
      if(result.isSubclassable) {
        addText(methodElement, '\u2004\u2004');
        const subclassableIcon = document.createElement('div')
        subclassableIcon.classList.add('codicon', `codicon-type-hierarchy-sub`, 'modifier')
        subclassableIcon.setAttribute('title', 'Subclassable')
        methodElement.appendChild(subclassableIcon);
      }
  
      // addText(methodElement, result.infoString, 'info-entry');
  
      methodElement.addEventListener('click', () => {
        console.log(result)
        // handleMethodClicked(result.className, result.methodName, result.package);
      });
  
      resultsList.appendChild(methodElement);
    })


      // const commentLines = methodData.commentLines
      // const commentsLength = commentLines.length;
      // if (methodData.argsString || commentsLength > 0) {
      //   const ul = document.createElement('ul');
      //   ul.className = 'info-list';

      //   if (methodData.argsString) {
      //     const argElement = document.createElement('li');
      //     argElement.className = 'args-element';
      //     const str = methodData.argsString.trim().replace(/\s+/g, '\u2002\u2004');
      //     const argsText = document.createTextNode(str);
      //     argElement.appendChild(argsText);
      //     ul.appendChild(argElement);
      //   }

      //   if (commentsLength > 0) {
      //     let endIndex = 0;
      //     for (let lineIndex = commentsLength - 1; lineIndex > -1; lineIndex--) {
      //       const line = commentLines[lineIndex];
      //       const commentParts = line.split('##');
      //       const str = commentParts[commentParts.length - 1];

      //       if (str.trim().length !== 0) {
      //         endIndex = lineIndex;
      //         break;
      //       }
      //     }

      //     let checkEmpty = true;
      //     for (let lineIndex = 0; lineIndex < endIndex + 1; lineIndex++) {
      //       const line = commentLines[lineIndex];
      //       const commentParts = line.split('##');
      //       let str = commentParts[commentParts.length - 1];

      //       if (str.trim().length === 0) {
      //         if (checkEmpty) {
      //           continue;
      //         }
      //         str = '\u2002';
      //       }
      //       checkEmpty = false;

      //       str = str.replace(/\s/gy, '\u2002');

      //       const commentElement = document.createElement('li');
      //       commentElement.className = 'comment-element';
      //       const commentText = document.createTextNode(str);
      //       commentElement.appendChild(commentText);
      //       ul.appendChild(commentElement);
      //     }
      //   }

      //   resultsList.appendChild(ul);
      // }

    // navigationElements = navElements;
    // selectedElement = undefined;
  }

  function enableSearch(enabled) {
    textfields.forEach(textfield => textfield.disabled = !enabled)
    buttons.forEach(button => button.disabled = !enabled)
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

  function capitalizeFirstLetter(string) {
    const firstLetter = string.charAt(0)
    return string.replace(firstLetter, firstLetter.toUpperCase())
  }

  vscode.postMessage({type: 'ready'});
}());
