/**
 * @author Nicolas CARPi <nico-git@deltablot.email>
 * @copyright 2012 Nicolas CARPi
 * @see https://www.elabftw.net Official website
 * @license AGPL-3.0
 * @package elabftw
 */
import { Action, Entity, EntityType } from './interfaces';
import { adjustHiddenState } from './misc';
import i18next from 'i18next';
import { Api } from './Apiv2.class';
import { ValidMetadata, ExtraFieldProperties, ExtraFieldsGroup, ExtraFieldInputType } from './metadataInterfaces';
import JsonEditorHelper from './JsonEditorHelper.class';


export function ResourceNotFoundException(message: string): void {
  this.message = message;
  this.name = 'ResourceNotFoundException';
}

export class Metadata {
  entity: Entity;
  editor: JsonEditorHelper;
  model: EntityType;
  api: Api;
  metadataDiv: Element;

  constructor(entity: Entity, jsonEditor: JsonEditorHelper) {
    this.entity = entity;
    this.editor = jsonEditor;
    this.model = entity.type;
    this.api = new Api();
    // this is the div that will hold all the generated fields from metadata json
    this.metadataDiv = document.getElementById('metadataDiv');
  }

  /**
   * Get the json from the metadata column
   */
  read(): Promise<Record<string, unknown>|ValidMetadata> {
    return this.api.getJson(`${this.entity.type}/${this.entity.id}`).then(json => {
      // if there are no metadata.json file available, return an empty object
      if (typeof json.metadata === 'undefined' || !json.metadata) {
        return {};
      }
      return JSON.parse(json.metadata);
    });
  }

  /**
   * Only save a single field value after a change
   */
  handleEvent(event: Event): Promise<Response> | boolean {
    const el = event.target as HTMLFormElement;
    if (el.reportValidity() === false || el.hasAttribute('readonly')) {
      return false;
    }
    if (el.dataset.units === '1') {
      return this.updateUnit(event);
    }
    // by default the value is simply the value of the input, which is the event target
    let value = el.value;
    // special case for checkboxes
    if (el.type === 'checkbox') {
      value = el.checked ? 'on': 'off';
    }
    // special case for multiselect
    if (el.hasAttribute('multiple')) {
      // collect all the selected options, and the value will be an array
      value = [...el.selectedOptions].map(option => option.value);
    }
    const params = {};
    params['action'] = Action.UpdateMetadataField;
    params[el.dataset.field] = value;
    this.api.patch(`${this.entity.type}/${this.entity.id}`, params).then(() => {
      this.editor.loadMetadata();
    });
    return true;
  }

  updateUnit(event: Event): Promise<Response> {
    const select = (event.target as HTMLSelectElement);
    const value = select.value;
    const name = select.parentElement.parentElement.parentElement.querySelector('label').innerText;
    return this.read().then(metadata => {
      metadata.extra_fields[name].unit = value;
      return this.save(metadata as ValidMetadata);
    });
  }
  /**
   * Save the whole json at once, coming from json editor save button
   */
  update(metadata: ValidMetadata): Promise<void> {
    return this.save(metadata).then(() => this.display('edit'));
  }

  save(metadata: ValidMetadata): Promise<Response> {
    return this.api.patch(`${this.entity.type}/${this.entity.id}`, {'metadata': JSON.stringify(metadata)});
  }

  /**
   * For radio we need a special build workflow
   */
  buildRadio(name: string, properties: ExtraFieldProperties): Element { // eslint-disable-line
    // a div to hold the different elements so we can return a single Element
    const element = document.createElement('div');
    element.dataset.purpose = 'radio-holder';

    const radioInputs = [];
    const radiosName = this.getRandomId();
    for (const option of properties.options) {
      const radioInput = document.createElement('input');
      radioInput.classList.add('form-check-input');
      radioInput.type = 'radio';
      radioInput.checked = properties.value === option ? true : false;
      radioInput.value = option;
      // they all need to have the same name to work together
      radioInput.name = radiosName;
      radioInput.id = this.getRandomId();
      // add a data-field attribute so we know what to update on change
      radioInput.dataset.field = name;
      radioInputs.push(radioInput);
    }

    for (const input of radioInputs) {
      const wrapperDiv = document.createElement('div');
      wrapperDiv.classList.add('form-check', 'form-check-inline');
      element.appendChild(wrapperDiv);
      wrapperDiv.appendChild(input);
      const label = document.createElement('label');
      label.htmlFor = input.id;
      label.innerText = input.value;
      label.classList.add('form-check-label');
      wrapperDiv.appendChild(label);
    }
    element.addEventListener('change', this, false);
    return element;
  }

  getRandomId(): string {
    return Math.random().toString(36).substring(2, 12);
  }

  generateElement(mode: string, name: string, properties: ExtraFieldProperties): Element {
    if (mode === 'view') {
      return this.generateViewableElement(name, properties);
    }
    return this.generateInput(name, properties);
  }

  /**
   * Generate a non editable view of the extra fields
   */
  generateViewableElement(name: string, properties: ExtraFieldProperties): Element {
    const wrapperDiv = document.createElement('div');
    wrapperDiv.classList.add('d-flex');
    // name + description
    const nameWrapper = document.createElement('div');
    nameWrapper.classList.add('flex-column');

    const nameEl = document.createElement('p');
    nameEl.innerText = name;
    nameWrapper.append(nameEl);
    nameWrapper.append(this.getDescription(properties));

    let valueEl: HTMLElement;
    // checkbox is special case
    if (properties.type === 'checkbox') {
      valueEl = document.createElement('input');
      valueEl.setAttribute('type', 'checkbox');
      valueEl.classList.add('d-block');
      (valueEl as HTMLInputElement).disabled = true;
      if (properties.value === 'on') {
        (valueEl as HTMLInputElement).checked = true;
      }
    } else {
      valueEl = document.createElement('div');
      let value = properties.value as string;
      if (properties.unit) {
        value += ' ' + properties.unit;
      }
      valueEl.innerText = value;
      // the link is generated with javascript so we can still use innerText and
      // not innerHTML with manual "<a href...>" which implicates security considerations
      if (properties.type === 'url') {
        valueEl.dataset.genLink = 'true';
      }
    }
    const valueWrapper = document.createElement('div');
    // set the value on the right
    valueWrapper.classList.add('ml-auto', 'pl-5');
    valueWrapper.append(valueEl);
    wrapperDiv.append(nameWrapper);
    wrapperDiv.append(valueWrapper);
    return wrapperDiv;
  }

  /**
   * Take the json description of the field and build an input element to be injected
   */
  generateInput(name: string, properties: ExtraFieldProperties): Element {
    // we don't know yet which kind of element it will be
    let element: HTMLInputElement|HTMLSelectElement;
    // generate a unique id for the element so we can associate the label properly
    const uniqid = this.getRandomId();

    // read the type of element
    switch (properties.type) {
    case ExtraFieldInputType.Checkbox:
    case ExtraFieldInputType.Date:
    case ExtraFieldInputType.DateTime:
    case ExtraFieldInputType.Email:
    case ExtraFieldInputType.Number:
    case ExtraFieldInputType.Time:
    case ExtraFieldInputType.Url:
      element = document.createElement('input');
      element.type = properties.type;
      // without this, it is not possible to enter floating point values
      if (properties.type === ExtraFieldInputType.Number) {
        element.setAttribute('step', 'any');
      }
      break;
    case ExtraFieldInputType.Select:
      element = document.createElement('select');
      if (properties.allow_multi_values === true) {
        element.toggleAttribute('multiple');
      }
      // add options to select element
      for (const option of properties.options) {
        const optionEl = document.createElement('option');
        optionEl.text = option;
        if (properties.allow_multi_values === true && (properties.value as Array<string>).includes(option)) {
          optionEl.setAttribute('selected', '');
        }
        element.add(optionEl);
      }
      break;
    case ExtraFieldInputType.Radio:
      return this.buildRadio(name, properties);
    default:
      element = document.createElement('input');
      element.type = 'text';
    }

    // add the unique id to the element
    element.id = uniqid;

    if (Object.prototype.hasOwnProperty.call(properties, 'value')) {
      if (element.type === 'checkbox') {
        (element as HTMLInputElement).checked = properties.value === 'on' ? true : false;
      }
      if (properties.allow_multi_values !== true) {
        element.value = properties.value as string;
      }
    }

    if (Object.prototype.hasOwnProperty.call(properties, 'required')) {
      element.required = true;
    }
    if (Object.prototype.hasOwnProperty.call(properties, 'readonly') && properties.readonly === true) {
      // readonly is not supported by select elements, but disabled is
      if (element instanceof HTMLSelectElement) {
        element.disabled = true;
      } else {
        element.readOnly = true;
      }
    }

    // by default all inputs get this bootstrap class
    let cssClass = 'form-control';
    // but checkboxes/radios need a different one
    if (properties.type === 'checkbox') {
      cssClass = 'form-check-input';
    }
    element.classList.add(cssClass);

    // add a data-field attribute so we know what to update on change
    element.dataset.field = name;
    // add an onChange listener to the element
    // so the json can be updated without having to click save
    // set the callback to the whole class so handleEvent is called and 'this' refers to the class
    // not the event in the function called
    element.addEventListener('change', this, false);

    // add a prepend button for "Now" for date and time types
    if (['time', 'date', 'datetime-local'].includes(element.type)) {
      const inputGroupDiv = document.createElement('div');
      inputGroupDiv.classList.add('input-group');
      const prependDiv = document.createElement('div');
      prependDiv.classList.add('input-group-prepend');
      // NOW/TODAY button
      const btn = document.createElement('button');
      btn.innerText = ['time', 'datetime-local'].includes(element.type) ? i18next.t('now') : i18next.t('today');
      btn.dataset.action = 'update-to-now';
      btn.classList.add('btn', 'btn-secondary');
      prependDiv.appendChild(btn);

      inputGroupDiv.appendChild(prependDiv);
      // now add the input
      inputGroupDiv.appendChild(element);
      // add the unique id to the input group for the label
      inputGroupDiv.id = uniqid;
      return inputGroupDiv;
    }

    // UNITS
    if (Object.prototype.hasOwnProperty.call(properties, 'units') && properties.units.length > 0) {
      const inputGroupDiv = document.createElement('div');
      inputGroupDiv.classList.add('input-group');
      const appendDiv = document.createElement('div');
      appendDiv.classList.add('input-group-append');
      const unitsSel = document.createElement('select');
      for (const unit of properties.units) {
        const optionEl = document.createElement('option');
        optionEl.text = unit;
        if (properties.unit === unit) {
          optionEl.setAttribute('selected', '');
        }
        unitsSel.add(optionEl);
      }
      unitsSel.classList.add('form-control', 'brl-none');
      // add this so we can differentiate the change event from the main input
      unitsSel.dataset.units = '1';
      unitsSel.addEventListener('change', this, false);
      appendDiv.appendChild(unitsSel);
      // input first, then append div
      inputGroupDiv.appendChild(element);
      inputGroupDiv.appendChild(appendDiv);
      // add the unique id to the input group for the label
      inputGroupDiv.id = uniqid;
      return inputGroupDiv;
    }

    // USERS/EXPERIMENTS/ITEMS input have a prepend to the input with a magnifying glass
    if ([ExtraFieldInputType.Users, ExtraFieldInputType.Experiments, ExtraFieldInputType.Items].includes(properties.type)) {
      // set the target for autocomplete function
      element.dataset.completeTarget = properties.type;
      const inputGroupDiv = document.createElement('div');
      inputGroupDiv.classList.add('input-group');
      const prependDiv = document.createElement('div');
      prependDiv.classList.add('input-group-prepend');
      const icon = document.createElement('i');
      icon.classList.add('fas', 'fa-magnifying-glass');
      const iconWrapper = document.createElement('span');
      iconWrapper.classList.add('input-group-text');
      iconWrapper.appendChild(icon);
      prependDiv.appendChild(iconWrapper);
      inputGroupDiv.appendChild(prependDiv);
      inputGroupDiv.appendChild(element);
      // add the unique id to the input group for the label
      inputGroupDiv.id = uniqid;

      return inputGroupDiv;
    }

    return element;
  }

  /**
   * Main public function to call to display the metadata in view or edit mode
   */
  display(mode: string): Promise<void> {
    let displayFunction = this.view;
    if (mode === 'edit') {
      displayFunction = this.edit;
    }

    // clear previous content
    this.metadataDiv.textContent = '';
    return displayFunction.call(this).catch(e => {
      if (e instanceof ResourceNotFoundException) {
        // no metadata is associated but it's okay, it's not an error
        return;
      }
      // if there was an issue fetching metadata, log the error
      console.error(e);
    }).then(() => adjustHiddenState());
  }

  /**
   * In view mode, display the extra fields, currently only used with toggle body function
   */
  view(): Promise<void> {
    return this.read().then(json => {
      // do nothing more if there is no extra_fields in our json
      if (!Object.prototype.hasOwnProperty.call(json, 'extra_fields')) {
        return;
      }
      const [groups, groupedArr] = this.getGroups('view', json as ValidMetadata);
      groups.forEach(group => {
        const groupWrapperDiv =  document.createElement('div');
        groupWrapperDiv.classList.add('mt-4');

        let headerEl = 'h4';
        // for the default group, don't show "default" but use hr instead
        if (group.id === -1) {
          headerEl = 'hr';
        }
        const groupHeader = document.createElement(headerEl);
        groupHeader.classList.add('d-inline');
        // only add content to the header if there are more than one group
        if (groups.length > 1 && groupHeader instanceof HTMLHeadingElement) {
          groupHeader.textContent = group.name;
        }

        groupWrapperDiv.append(groupHeader);
        // now display the names/values from extra_fields
        for (const element of groupedArr[group.id].sort((a: ExtraFieldProperties, b: ExtraFieldProperties) => a.position - b.position)) {
          groupWrapperDiv.append(element.element);
        }
        groupWrapperDiv.append(document.createElement('hr'));
        this.metadataDiv.append(groupWrapperDiv);
      });
    });
  }

  // build a description element
  getDescription(properties: ExtraFieldProperties): HTMLSpanElement {
    const descriptionWrapper = document.createElement('div');
    if (properties.description) {
      const descriptionEl = document.createElement('p');
      descriptionEl.classList.add('smallgray');
      descriptionEl.innerText = properties.description;
      descriptionWrapper.append(descriptionEl);
    }
    return descriptionWrapper;
  }

  getGroups(mode: string, json: ValidMetadata) {
    // collect all extra fields, normalize position and group_id, add an element property
    const elements = [];
    for (const [name, properties] of Object.entries(json.extra_fields)) {
      elements.push({
        name: name,
        description: properties.description,
        element: this.generateElement(mode, name, properties),
        position: parseInt(String(properties.position), 10) || 99999,
        group_id: properties.group_id || -1,
      });
    }

    // collect extra fields groups if they are defined
    let groups: Array<ExtraFieldsGroup> = [];
    if (Object.prototype.hasOwnProperty.call(json, 'elabftw')) {
      if (Object.prototype.hasOwnProperty.call(json.elabftw, 'extra_fields_groups')) {
        groups = groups.concat(json.elabftw.extra_fields_groups);
      }
    }

    // group the elements based on the group property
    const groupedArr = elements.reduce((grouped, el) => {
      // make sure the group_id is part of the defined elabftw.groups, or assign it to group -1
      const group = groups.some(grp => grp.id === parseInt(el.group_id, 10)) ? el.group_id : -1;
      grouped[group] = grouped[group] || [];
      grouped[group].push(el);
      return grouped;
    }, {});

    // add the undefined group at the end, but only if there are fields without groups
    if (elements.some(entry => entry.group_id === -1)) {
      groups = groups.concat([{id: -1, name: i18next.t('undefined-group')}]);
    }

    return [groups, groupedArr];
  }

  /**
   * Get the metadata json and add input elements to DOM
   */
  edit(): Promise<void> {
    return this.read().then(json => {
      this.editor.refresh(json as ValidMetadata);
      // do nothing more if there is no extra_fields in our json
      if (!Object.prototype.hasOwnProperty.call(json, 'extra_fields')) {
        return;
      }

      const [groups, groupedArr] = this.getGroups('edit', json as ValidMetadata);
      // the full content of extra fields
      const wrapperDiv = document.createElement('div');

      groups.forEach(group => {
        // make sure there is an element in that group
        if (Object.prototype.hasOwnProperty.call(groupedArr, group.id)) {
          const groupWrapperDiv =  document.createElement('div');
          groupWrapperDiv.classList.add('mt-4');
          const groupHeader = document.createElement('h4');
          groupHeader.dataset.action='toggle-next';
          groupHeader.classList.add('d-inline', 'togglable-section-title');
          const groupHeaderIcon = document.createElement('i');
          groupHeaderIcon.classList.add('fas', 'fa-caret-down', 'fa-fw', 'mr-2');
          // only add content to the header if there are more than one group
          if (groups.length > 1 && groupHeader instanceof HTMLHeadingElement) {
            groupHeader.textContent = group.name;
            groupHeader.insertAdjacentElement('afterbegin', groupHeaderIcon);
          }

          const wrapperUl = document.createElement('ul');
          wrapperUl.classList.add('list-group', 'mt-2');
          wrapperUl.dataset.saveHidden = `extra_fields_group_${this.entity.type}_${this.entity.id}_${group.id}`;

          for (const element of groupedArr[group.id].sort((a: ExtraFieldProperties, b: ExtraFieldProperties) => a.position - b.position)) {
            const listItem = document.createElement('li');
            listItem.classList.add('list-group-item');
            const labelDiv = document.createElement('div');
            labelDiv.classList.add('d-flex', 'justify-content-between');

            // LABEL
            const label = document.createElement('label');
            label.htmlFor = element.element.id;
            label.innerText = element.name as string;
            if (element.element.required) {
              label.classList.add('required-label');
            }
            label.classList.add('py-2');

            // add a button to delete the field
            const deleteBtn = document.createElement('button');
            deleteBtn.dataset.action = 'metadata-rm-field';
            deleteBtn.classList.add('btn', 'p-2', 'hl-hover-gray', 'border-0', 'lh-normal');
            const deleteIcon = document.createElement('i');
            deleteIcon.classList.add('fas', 'fa-trash-alt');
            deleteBtn.appendChild(deleteIcon);

            labelDiv.append(label);
            labelDiv.append(deleteBtn);

            // for checkboxes the label comes second
            if (element.element.type === 'checkbox') {
              label.classList.add('form-check-label');
              const wrapperDiv = document.createElement('div');
              wrapperDiv.classList.add('form-check');
              listItem.append(wrapperDiv);
              wrapperDiv.append(element.element);
              wrapperDiv.append(labelDiv);
              wrapperDiv.append(this.getDescription(element));
            } else {
              listItem.append(labelDiv);
              listItem.append(this.getDescription(element));
              listItem.append(element.element);
            }

            wrapperUl.append(listItem);
          }
          groupWrapperDiv.append(groupHeader);
          groupWrapperDiv.append(wrapperUl);
          wrapperDiv.append(groupWrapperDiv);
        }
      });

      this.metadataDiv.append(wrapperDiv);
    });
  }
}
