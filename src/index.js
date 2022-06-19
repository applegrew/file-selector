import './index.pcss';

import Uploader from './uploader';
import Icon from './svg/toolbox.svg';
import FileIcon from './svg/standard.svg';
import CustomFileIcon from './svg/custom.svg';
// import DownloadIcon from './svg/arrow-download.svg';

const LOADER_TIMEOUT = 500;

/**
* @typedef {object} file-selectorToolData
* @description file-selector Tool's output data format
* @property {file-selectorFileData} file - object containing information about the file
* @property {string} title - file's title
*/

/**
* @typedef {object} file-selectorFileData
* @description file-selector Tool's file format
* @property {string} [url] - file's upload url
* @property {string} [size] - file's size
* @property {string} [extension] - file's extension
* @property {string} [name] - file's name
*/

/**
* @typedef {object} FileData
* @description file-selector Tool's response from backend
* @property {string} url - file's url
* @property {string} name - file's name with extension
* @property {string} extension - file's extension
*/

/**
* @typedef {object} UploadResponseFormat
* @description This format expected from backend on file upload
* @property {number} success  - 1 for successful uploading, 0 for failure
* @property {FileData} file - backend response with uploaded file data.
*/

/**
* @typedef {object} file-selectorToolConfig
* @description Config supported by Tool
* @property {string} endpoint - file upload url
* @property {string} field - field name for uploaded file
* @property {string} types - available mime-types
* @property {string} placeholder
* @property {string} errorMessage
* @property {object} [uploader] - optional custom uploader
* @property {function(File): Promise.<UploadResponseFormat>} [uploader.uploadByFile] - custom method that upload file and returns response
*/

/**
* @class file-selectorTool
* @classdesc file-selectorTool for Editor.js 2.0
*
* @property {API} api - Editor.js API
* @property {file-selectorToolData} data
* @property {file-selectorToolConfig} config
*/
export default class FileSelectorTool {
  /**
  * @param {file-selectorToolData} data
  * @param {object} config
  * @param {API} api
  */
  constructor({ data, config, api, block}) {
    this.api = api;
    this.block = block;
    
    this.nodes = {
      wrapper: null,
      button: null,
      title: null
    };
    
    this._displayData = {
      file: {},
      title: ''
    };
    
    this.config = {
      settings: config.settings || [],
      endpoint: config.endpoint || '',
      types: config.types || '*',
      buttonText: config.buttonText || 'Select file to upload',
      errorMessage: config.errorMessage || 'File upload failed',
      uploader: config.uploader || undefined,
    };
    
    this._data = data || {};
    
    /**
    * Module for files uploading
    */
    this.uploader = new Uploader({
      config: this.config,
      onUpload: (response) => this.onUpload(response),
      onError: (error) => this.uploadingFailed(error)
    });
    
    this.enableFileUpload = this.enableFileUpload.bind(this);
  }
  
  /**
  * Get Tool toolbox settings
  * icon - Tool icon's SVG
  * title - title to show in toolbox
  */
  static get toolbox() {
    return {
      icon: Icon,
      title: 'File'
    };
  }
  
  /**
  * Tool's CSS classes
  */
  get CSS() {
    return {
      baseClass: this.api.styles.block,
      apiButton: this.api.styles.button,
      loader: this.api.styles.loader,
      /**
      * Tool's classes
      */
      wrapper: 'cdx-file-selector',
      wrapperWithFile: 'cdx-file-selector--with-file',
      wrapperLoading: 'cdx-file-selector--loading',
      button: 'cdx-file-selector__button',
      title: 'cdx-file-selector__title',
      size: 'cdx-file-selector__size',
      downloadButton: 'cdx-file-selector__download-button',
      fileInfo: 'cdx-file-selector__file-info',
      fileIcon: 'cdx-file-selector__file-icon'
    };
  }
  
  /**
  * Possible files' extension colors
  */
  get EXTENSIONS() {
    return {
      doc: '#3e74da',
      docx: '#3e74da',
      odt: '#3e74da',
      pdf: '#d47373',
      rtf: '#656ecd',
      tex: '#5a5a5b',
      txt: '#5a5a5b',
      pptx: '#e07066',
      ppt: '#e07066',
      mp3: '#eab456',
      mp4: '#f676a6',
      xls: '#3f9e64',
      xlsx: '#3f9e64',
      html: '#2988f0',
      htm: '#2988f0',
      png: '#f676a6',
      jpg: '#f67676',
      jpeg: '#f67676',
      gif: '#f6af76',
      zip: '#4f566f',
      rar: '#4f566f',
      exe: '#e26f6f',
      svg: '#bf5252',
      key: '#e07066',
      sketch: '#df821c',
      ai: '#df821c',
      psd: '#388ae5',
      dmg: '#e26f6f',
      json: '#2988f0',
      csv: '#3f9e64'
    };
  }
  
  /**
  * Validate block data:
  * - check for emptiness
  *
  * @param {file-selectorToolData} savedData — data received after saving
  * @returns {boolean} false if saved data is not correct, otherwise true
  * @public
  */
  validate(savedData) {
    return true;
  }
  
  /**
  * Return Block data
  *
  * @param {HTMLElement} toolsContent
  * @returns {file-selectorToolData}
  */
  save(toolsContent) {    
    return this.data;
  }
  
  /**
  * Renders Block content
  *
  * @returns {HTMLDivElement}
  */
  render() {
    const holder = this.make('div', this.CSS.baseClass);
    
    this.nodes.wrapper = this.make('div', this.CSS.wrapper);
    
    if (this.pluginHasData()) {
      this.showFileData();
    } else {
      this.prepareUploadButton();
    }
    
    holder.appendChild(this.nodes.wrapper);
    
    return holder;
  }

  renderSettings() {
    const settings = this.config.settings;
    const wrapper = document.createElement('div');
    wrapper.classList.add('file-selector-settings');

    settings.forEach(tune => {
      const title = this.api.i18n.t(tune.title);
      let button = document.createElement('div');
      button.classList.add('cdx-settings-button');
      button.innerHTML = tune.icon;
      if (tune.onClick)
        button.addEventListener('click', () => {
          tune.onClick({data: this.data, block: this});
        });
      this.api.tooltip.onHover(button, title, {
        placement: 'top',
      });
      wrapper.appendChild(button);
    });

    return wrapper;
  }
  
  /**
  * Prepares button for file uploading
  */
  prepareUploadButton() {
    this.nodes.button = this.make('div', [this.CSS.apiButton, this.CSS.button]);
    this.nodes.button.innerHTML = `${Icon} ${this.config.buttonText}`;
    this.nodes.button.addEventListener('click', this.enableFileUpload);
    this.nodes.wrapper.appendChild(this.nodes.button);
  }
  
  /**
  * Fires after clicks on the Toolbox file-selectorTool Icon
  * Initiates click on the Select File button
  *
  * @public
  */
  rendered() {
    // this.nodes.button.click();
  }
  
  /**
  * Checks if any of Tool's fields have data
  *
  * @returns {boolean}
  */
  pluginHasData() {
    return this._displayData.title !== '' || Object.values(this._displayData.file).some(item => item !== undefined);
  }
  
  /**
  * Allow to upload files on button click
  */
  enableFileUpload() {
    this.uploader.uploadSelectedFile({
      onPreview: () => {
        this.nodes.wrapper.classList.add(this.CSS.wrapperLoading, this.CSS.loader);
      }
    });
  }
  
  /**
  * File uploading callback
  *
  * @param {UploadResponseFormat} response
  */
  onUpload(response) {
    const body = response;
    
    if (body.success && body.file) {
      const { name, size, title } = body.file;
      
      this._displayData = {
        file: {
          extension: name ? name.split('.').pop().toLowerCase() : '',
          name,
          size,
        },
        title,
      };
      
      this.nodes.button.remove();
      this.showFileData();
      //this.moveCaretToEnd(this.nodes.title);
      //this.nodes.title.focus();
      this.removeLoader();
    } else {
      this.uploadingFailed(this.config.errorMessage);
    }
  }
  
  /**
  * Handles uploaded file's extension and appends corresponding icon
  */
  appendFileIcon() {
    const extension = this._displayData.file.extension || '';
    const extensionColor = this.EXTENSIONS[extension];
    
    const fileIcon = this.make('div', this.CSS.fileIcon, {
      innerHTML: extensionColor ? CustomFileIcon : FileIcon
    });
    
    if (extensionColor) {
      fileIcon.style.color = extensionColor;
      if (extension.length > 3)
        fileIcon.classList.add('longer');
      else
        fileIcon.classList.remove('longer');
      fileIcon.setAttribute('data-extension', extension);
    }
    
    this.nodes.wrapper.appendChild(fileIcon);
  }
  
  /**
  * Removes tool's loader
  */
  removeLoader() {
    setTimeout(() => this.nodes.wrapper.classList.remove(this.CSS.wrapperLoading, this.CSS.loader), LOADER_TIMEOUT);
  }
  
  /**
  * If upload is successful, show info about the file
  */
  showFileData() {
    this.nodes.wrapper.innerHTML = '';
    this.nodes.wrapper.classList.add(this.CSS.wrapperWithFile);
    
    const { file: { size }, title } = this._displayData;
    
    this.appendFileIcon();
    
    const fileInfo = this.make('div', this.CSS.fileInfo);
    
    if (title) {
      this.nodes.title = this.make('div', this.CSS.title, {
        contentEditable: false
      });
      
      this.nodes.title.textContent = title;
      fileInfo.appendChild(this.nodes.title);
    }
    
    if (size) {
      let sizePrefix;
      let formattedSize;
      const fileSize = this.make('div', this.CSS.size);
      
      if (Math.log10(+size) >= 6) {
        sizePrefix = 'MiB';
        formattedSize = size / Math.pow(2, 20);
      } else {
        sizePrefix = 'KiB';
        formattedSize = size / Math.pow(2, 10);
      }
      
      fileSize.textContent = formattedSize.toFixed(1);
      fileSize.setAttribute('data-size', sizePrefix);
      fileInfo.appendChild(fileSize);
    }
    
    this.nodes.wrapper.appendChild(fileInfo);

    this.nodes.wrapper.addEventListener('click', this.enableFileUpload);
    
    // const downloadIcon = this.make('a', this.CSS.downloadButton, {
    //   innerHTML: DownloadIcon,
    //   href: url,
    //   target: '_blank',
    //   rel: 'nofollow noindex noreferrer'
    // });
    
    // this.nodes.wrapper.appendChild(downloadIcon);
  }
  
  /**
  * If file uploading failed, remove loader and show notification
  *
  * @param {string} errorMessage -  error message
  */
  uploadingFailed(errorMessage) {
    this.api.notifier.show({
      message: errorMessage,
      style: 'error'
    });
    
    this.removeLoader();
  }
  
  /**
  * Return file-selector Tool's data
  *
  * @returns {file-selectorToolData}
  */
  get data() {
    return this._data;
  }
  
  /**
  * Stores all Tool's data
  *
  * @param {file-selectorToolData} data
  */
  set data(data) {
    this._data = data || {};
    this.block.dispatchChange();
  }
  
  /**
  * Moves caret to the end of contentEditable element
  *
  * @param {HTMLElement} element - contentEditable element
  */
  moveCaretToEnd(element) {
    const range = document.createRange();
    const selection = window.getSelection();
    
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }
  
  /**
  * Helper method for elements creation
  *
  * @param tagName
  * @param classNames
  * @param attributes
  * @returns {HTMLElement}
  */
  make(tagName, classNames = null, attributes = {}) {
    const el = document.createElement(tagName);
    
    if (Array.isArray(classNames)) {
      el.classList.add(...classNames);
    } else if (classNames) {
      el.classList.add(classNames);
    }
    
    for (const attrName in attributes) {
      el[attrName] = attributes[attrName];
    }
    
    return el;
  }
}
