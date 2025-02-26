import { LightningElement, api, track, wire } from 'lwc';
import getProductCategories from '@salesforce/apex/VisitController.getProductCategories';
import getProducts from '@salesforce/apex/VisitController.getProducts'; 
import getUOM from '@salesforce/apex/VisitController.getUOM';
import createStock from '@salesforce/apex/VisitController.createStock';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class StockCreation extends LightningElement {
    @api distributorName;
    @api accountId;
    @api visit;
    @api selectedVisit;

    @track selectedCategory;
    @track selectedProduct;
    @track currentStock;
    @track comments;
    @track productCategories = [];
    @track products = [];
    @track uomOptions = [];

    connectedCallback() {
        this.loadProductCategories();
    }

    loadProductCategories() {
        getProductCategories()
            .then(result => {
                this.productCategories = result.map(category => ({
                    label: category,
                    value: category
                }));
            })
            .catch(error => {
                console.error('Error loading categories:', error);
            });
    }

    handleCategoryChange(event) {
        this.selectedCategory = event.target.value;
        this.selectedProduct = null; // Reset product when category changes
        
        if (this.selectedCategory) {
            getProducts({ category: this.selectedCategory })
                .then(result => {
                    console.log('Products received:', result);
                    this.products = result.map(product => ({
                        label: product.Name,
                        value: product.Id
                    }));
                })
                .catch(error => {
                    console.error('Error loading products:', error);
                });
        }
    }

    handleProductChange(event) {
        console.log('Selected Product:', event.target.value);
        this.selectedProduct = event.target.value;
        // Add debug logs
        console.log('Product after selection:', {
            selectedProduct: this.selectedProduct,
            eventValue: event.target.value,
            eventDetail: event.detail
        });
    }

    @wire(getUOM)
    wiredUOM({ error, data }) {
        if (data) {
            this.uomOptions = data.map(uom => ({
                label: uom,
                value: uom
            }));
            this.uomOptions.unshift({ label: 'Select UOM', value: '' }); // Add None option
        } else if (error) {
            console.error('Error fetching UOM:', error);
        }
    }

    handleUOMChange(event) {
        this.selectedUOM = event.target.value;
    }

    handleStockChange(event) {
        // Convert to integer and ensure it's within valid range
        const value = parseInt(event.target.value);

        if (value <= 0) {
            this.showToast('Error', 'Stock must be greater than zero', 'error');
            event.target.value = ''; // Clear the input
            this.currentStock = null;
            return;
        }
        if (!isNaN(value) && value >= 0) {
            this.currentStock = value;
        }
    }

    handleCommentsChange(event) {
        this.comments = event.target.value;
        console.log('Comments updated:', this.comments);
    }

    handleCancel() {
        this.dispatchEvent(new CustomEvent('cancel'));
    }

    handleSave() {
        // Validate all required fields
        if (!this.accountId) {
            this.showToast('Error', 'Account is required', 'error');
            return;
        }

        if (!this.selectedProduct) {
            this.showToast('Error', 'Please select a product', 'error');
            return;
        }

        if (!this.selectedUOM) {
            this.showToast('Error', 'Please select a UOM', 'error');
            return;
        }

        if (!this.currentStock && this.currentStock !== 0) {
            this.showToast('Error', 'Please enter current stock', 'error');
            return;
        }

        if (!this.comments || this.comments.trim() === '') {
            this.showToast('Error', 'Please enter comments', 'error');
            return;
        }

        // Add console logs for debugging
        console.log('Save Data:', {
            accountId: this.accountId,
            productId: this.selectedProduct,
            currentStock: this.currentStock,
            comments: this.comments,
            uom: this.selectedUOM
        });

        createStock({
            accountId: this.accountId,
            productId: this.selectedProduct,
            currentStock: parseInt(this.currentStock) || 0,
            comments: this.comments,
            uom: this.selectedUOM
        })
        .then(() => {
            this.showToast('Success', 'Stock created successfully', 'success');
            this.resetForm();
            this.dispatchEvent(new CustomEvent('save'));
        })
        .catch(error => {
            console.error('Error details:', JSON.stringify(error));
            const errorMessage = error.body?.message || 'Unknown error occurred';
            this.showToast('Error', 'Error creating stock record: ' + errorMessage, 'error');
        });
    }

    resetForm() {
        this.selectedCategory = null;
        this.selectedProduct = null;
        this.currentStock = null;
        this.comments = '';
        this.selectedUOM = 'Nos';
        
        // Reset the combobox values
        const categoryCombobox = this.template.querySelector('[data-id="category-combobox"]');
        const productCombobox = this.template.querySelector('[data-id="product-combobox"]');
        if (categoryCombobox) categoryCombobox.value = null;
        if (productCombobox) productCombobox.value = null;
    }

    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title: title,
                message: message,
                variant: variant
            })
        );
    }

    get isProductDisabled() {
        return !this.selectedCategory;
    }

    get visitType() {
        return this.selectedVisit?.Visit_for__c || '';
    }

    get customerName() {
        return this.visit?.Customer__r?.Name || '';
    }
}