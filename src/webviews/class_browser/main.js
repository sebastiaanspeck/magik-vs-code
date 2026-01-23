'use strict';

// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.

(function main() {
  const vscode = acquireVsCodeApi();

  const methodInput = document.querySelector('#methodInput')
  const classInput = document.querySelector('#classInput')

  const resultsCounter = document.querySelector('.results-length')
  const resultsList = document.querySelector('.results-list')

  const textfields = document.querySelectorAll('input')
  const buttons = document.querySelectorAll('button')
  const inputs = [...textfields, ...buttons]

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
    const activeElement = document.activeElement;
    switch (e.key) {
      case 'Tab': 
        (activeElement === classInput ? methodInput : classInput).focus()
        e.preventDefault()
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
  };

  window.addEventListener('message', event => {
    const message = event.data;
    switch (message.type) {
      case 'enable':
        enable(message.enabled);
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

  /**
   * Enable/disable the class browser inputs
   * @param {boolean} enabled 
   */
  function enable(enabled) {
    textfields.forEach(textfield => textfield.disabled = !enabled)
    buttons.forEach(button => button.disabled = !enabled)
  }

  /**
   * Focusses and highlights the content of a search field
   * @param {string} input Either 'method' or 'class'
   * @returns 
   */
  function focusInput(input) {
    if (classInput.classList.contains('disabled')) {
      return
    }
    const selectedInput = input === 'method' ? methodInput : classInput
    selectedInput.focus();
    selectedInput.setSelectionRange(0, selectedInput.value.length);
  }

  /**
   * Update the current state of the class browser inputs
   * @param {object} searchParameters 
   */
  function updateSearchParameters(searchParameters) {
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

  /**
   * Clear the current search results and results counter
   */
  function clearResultList() {
    resultsList.textContent = '';
    resultsCounter.textContent = '';
  }

  /**
   * Append text to an element
   * @param {HTMLElement} element 
   * @param {string} text 
   * @param {string?} className 
   */
  function addText(element, text, className) {
    const textElement = document.createElement('span');
    if (className) {
      textElement.className = className;
    }
    textElement.appendChild(document.createTextNode(text));
    element.appendChild(textElement);
  }

  /**
   * Append an icon to an element
   * @param {HTMLElement} element 
   * @param {string} iconName 
   * @param {string?} className 
   * @param {string?} tooltip 
   */
  function addIcon(element, iconName, className, tooltip) {
    const iconElement = document.createElement('div')
    iconElement.classList.add('codicon', `codicon-${iconName}`)
    if(className) {
      iconElement.classList.add(className)
    }
    if(tooltip) {
      iconElement.setAttribute('title', tooltip)
    }
    element.appendChild(iconElement)
  }

  /**
   * Generate search result elements and update results counter
   * @param {object[]} results 
   * @param {string} resultsLength 
   */
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
  
      if(result.package) {
        addText(methodElement, result.package);
        addText(methodElement, '\u2004:\u2004');
      }

      addText(methodElement, result.class, 'class-entry');
      addText(methodElement, '\u2004.\u2004');
      if(result.method.endsWith('()')) {
        addArguments(methodElement, result)
      }
      else {
        addText(methodElement, result.method, 'method-entry');
      }

      [
        { name: 'private', icon: 'lock' },
        { name: 'subclassable', icon: 'type-hierarchy-sub' },
        { name: 'redefinable', icon: 'edit' },
        { name: 'iterator', icon: 'sync' },
      ].forEach(modifier => {
        if(result[modifier.name]) {
          addText(methodElement, '\u2004\u2004');
          addIcon(methodElement, modifier.icon, 'modifier', modifier.name)
        }
      })

      resultsList.appendChild(methodElement);

      if(result.comments.length) {
        addComments(result.comments)
      }
  
      methodElement.addEventListener('click', () => {
        console.log(result)
        gotoDefinition(result.class, result.method, result.package);
      });
    })
  }

  /**
   * Notify the class browser to jump to the definition of method
   * @param {string} className 
   * @param {string} methodName 
   * @param {string} packageName 
   */
  function gotoDefinition(className, methodName, packageName) {
    vscode.postMessage({
      type: 'goto',
      class: className,
      method: methodName,
      package: packageName
    })
  }

  /**
   * Append style method arguments to an element
   * @param {HTMLElement} element 
   * @param {object} result 
   */
  function addArguments(element, result) {
    addText(element, result.method.slice(0, -1) + '\u2004', 'method-entry')
    
    const requiredArgs = result.arguments.required
    if(requiredArgs.length) {
      addText(element, `${requiredArgs.join(', ')}\u2004`)
    }

    const optionalArgs = result.arguments.optional
    if(optionalArgs.length) {
      addText(element, 'OPTIONAL', 'optional-gather')
      addText(element, `\u2004${optionalArgs.join(', ')}\u2004`)
    }

    const gatherArg = result.arguments.gather
    if(gatherArg) {
      addText(element, 'GATHER', 'optional-gather')
      addText(element, `\u2004${gatherArg}\u2004`)
    }

    addText(element, ')', 'method-entry')
  }

  /**
   * Add styled method comments to the last method element
   * @param {string[]} comments 
   */
  function addComments(comments) {
    comments.forEach(comment => {
      switch(comment.type) {
        case 'text':
          addTextComment(comment)
          break
        case 'parameter':
          addParameterComment(comment)
          break
        case 'return': 
          addReturnComment(comment)
          break
        }
    })
  }

  /**
   * Add styled text comment
   * @param {object} textComment 
   */
  function addTextComment(textComment) {
    const commentsElement = document.createElement('ul')
    commentsElement.className = 'info-list'
    const commentElement = document.createElement('li')
    commentElement.className = 'comment-element'

    addText(commentElement, textComment.text, 'comment-text')

    commentsElement.appendChild(commentElement)
    resultsList.appendChild(commentsElement)
  }

  /**
   * Add styled parameter comment
   * @param {object} parameterComment 
   */
  function addParameterComment(parameterComment) {
    const commentsElement = document.createElement('ul')
    commentsElement.className = 'info-list'
    const commentElement = document.createElement('li')
    commentElement.className = 'comment-element'

    addIcon(commentElement, 'symbol-field', 'modifier', 'parameter')
    addText(commentElement, `\u2004${parameterComment.parameter}`)
    addText(commentElement, `\u2004${parameterComment.class}`, 'class-entry')
    addText(commentElement, `\u2004${parameterComment.description}`, 'comment-text')

    commentsElement.appendChild(commentElement)
    resultsList.appendChild(commentsElement)
  }

  /**
   * Add styled return value comment
   * @param {object} returnComment 
   */
  function addReturnComment(returnComment) {
    const commentsElement = document.createElement('ul')
    commentsElement.className = 'info-list'
    const commentElement = document.createElement('li')
    commentElement.className = 'comment-element'

    addIcon(commentElement, 'newline', 'modifier', 'return')
    addText(commentElement, `\u2004${returnComment.class}`, 'class-entry')
    addText(commentElement, `\u2004${returnComment.description}`, 'comment-text')
    
    commentsElement.appendChild(commentElement)
    resultsList.appendChild(commentsElement)
  }

  /**
   * Debounce a function call
   * @param {function} callback 
   * @param {number} wait In milliseconds
   * @returns 
   */
  function debounce(callback, wait) {
    let timeout;
    return (...args) => {
      const context = this;
      clearTimeout(timeout);
      timeout = setTimeout(() => callback.apply(context, args), wait);
    };
  }

  /**
   * Capitalize the first letter of a line
   * @param {string} line 
   * @returns 
   */
  function capitalizeFirstLetter(line) {
    const firstLetter = line.charAt(0)
    return line.replace(firstLetter, firstLetter.toUpperCase())
  }

  vscode.postMessage({type: 'ready'});
}());
