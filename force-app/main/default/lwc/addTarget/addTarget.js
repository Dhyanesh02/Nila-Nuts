import { LightningElement, track } from 'lwc';
import getSalesReps from '@salesforce/apex/TargetController.getSalesReps';
import getProductFamilies from '@salesforce/apex/TargetController.getProductFamilies';
import getProductsByFamily from '@salesforce/apex/TargetController.getProductsByFamily';
import getTargetPeriods from '@salesforce/apex/TargetController.getTargetPeriods';
import createTargetWithLineItems from '@salesforce/apex/TargetController.createTargetWithLineItems';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class AddTarget extends LightningElement {
    @track salesReps = [];
    @track categoryOptions = [];
    @track productList = [];
    @track storedProducts = {};  // Changed to object for better state management
    @track targetPeriods = [];
    @track targetName = '';
    @track selectedSalesRep = '';
    @track targetPeriod = '';
    @track selectedCategory = '';

    connectedCallback() {
        this.loadSalesReps();
        this.loadCategories();
        this.loadTargetPeriods();
    }

    async loadTargetPeriods() {
        try {
            this.targetPeriods = await getTargetPeriods();
        } catch (error) {
            this.showToast('Error', 'Error loading target periods', 'error');
        }
    }

    async loadSalesReps() {
        try {
            this.salesReps = await getSalesReps();
            console.log('Sales Reps:', this.salesReps);
        } catch (error) {
            console.error('Error loading sales reps:', error);
            this.showToast('Error', 'Error loading sales reps', 'error');
        }
    }

    async loadCategories() {
        try {
            const categories = await getProductFamilies();
            this.categoryOptions = categories.map(category => ({
                label: category,
                value: category
            }));
        } catch (error) {
            this.showToast('Error', 'Error loading categories', 'error');
        }
    }

    handleTargetNameChange(event) {
        this.targetName = event.target.value;
    }

    handleSalesRepChange(event) {
        this.selectedSalesRep = event.target.value;
    }

    handlePeriodChange(event) {
        this.targetPeriod = event.target.value;
    }

    async handleCategoryChange(event) {
        this.selectedCategory = event.target.value;
        if (this.selectedCategory) {
            try {
                const products = await getProductsByFamily({ family: this.selectedCategory });
                
                // Map new products with stored quantities and amounts
                this.productList = products.map(product => {
                    const storedProduct = this.storedProducts[product.Id] || {};
                    return {
                        ...product,
                        targetQuantity: storedProduct.targetQuantity || 0,
                        TargetAmount: storedProduct.TargetAmount || 0
                    };
                });

                // Update UI to show stored values
                this.productList.forEach(product => {
                    if (this.storedProducts[product.Id]) {
                        const input = this.template.querySelector(`[data-product-id="${product.Id}"]`);
                        if (input) {
                            input.value = this.storedProducts[product.Id].targetQuantity;
                        }
                    }
                });

            } catch (error) {
                this.showToast('Error', 'Error loading products', 'error');
            }
        }
    }

    handleQuantityChange(event) {
        const productId = event.target.dataset.productId;
        const quantity = parseInt(event.target.value) || 0;
        
        this.productList = this.productList.map(product => {
            if (product.Id === productId) {
                const targetAmount = quantity * product.Price__c;
                const updatedProduct = {
                    ...product,
                    targetQuantity: quantity,
                    TargetAmount: targetAmount.toFixed(2)
                };
                // Store the updated product
                this.storedProducts[productId] = {
                    ...updatedProduct,
                    Id: productId,
                    Price__c: product.Price__c
                };
                return updatedProduct;
            }
            return product;
        });
    }

    // Update the HTML input values when component re-renders
    renderedCallback() {
        this.productList.forEach(product => {
            const input = this.template.querySelector(`[data-product-id="${product.Id}"]`);
            if (input && this.storedProducts[product.Id]) {
                input.value = this.storedProducts[product.Id].targetQuantity || '';
            }
        });
    }

    get totalQuantity() {
        return Object.values(this.storedProducts)
            .reduce((sum, product) => sum + (product.targetQuantity || 0), 0);
    }

    get totalAmount() {
        return Object.values(this.storedProducts)
            .reduce((sum, product) => sum + (parseFloat(product.TargetAmount) || 0), 0)
            .toFixed(2);
    }

    get currentCategoryTotal() {
        return this.productList
            .reduce((sum, product) => sum + (parseFloat(product.TargetAmount) || 0), 0)
            .toFixed(2);
    }

    get currentCategoryQuantity() {
        return this.productList
            .reduce((sum, product) => sum + (product.targetQuantity || 0), 0);
    }

    async handleSave() {
        if (!this.validateInputs()) {
            return;
        }

        try {
            const targetData = {
                targetName: this.targetName,
                salesRepId: this.selectedSalesRep,
                targetPeriod: this.targetPeriod,
                lineItems: Object.values(this.storedProducts)
                    .filter(product => product.targetQuantity > 0)
                    .map(product => ({
                        productId: product.Id,
                        targetQuantity: product.targetQuantity,
                        targetAmount: product.TargetAmount
                    }))
            };

            await createTargetWithLineItems({ targetData: JSON.stringify(targetData) });
            this.showToast('Success', 'Target created successfully', 'success');
            this.handleCancel();
        } catch (error) {
            console.error('Save error:', error);
            this.showToast('Error', 'Error creating target: ' + error.message, 'error');
        }
    }

    validateInputs() {
        if (!this.targetName || !this.selectedSalesRep || !this.targetPeriod) {
            this.showToast('Error', 'Please fill all required fields', 'error');
            return false;
        }

        const hasProducts = Object.values(this.storedProducts)
            .some(product => product.targetQuantity > 0);

        if (!hasProducts) {
            this.showToast('Error', 'Please add at least one product target', 'error');
            return false;
        }

        return true;
    }

    handleCancel() {
        // Clear stored products when canceling
        this.storedProducts = {};
        this.productList = [];
        this.dispatchEvent(new CustomEvent('close'));
    }

    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title,
                message,
                variant
            })
        );
    }
}