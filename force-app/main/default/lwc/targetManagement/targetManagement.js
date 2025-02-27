import { LightningElement, track } from 'lwc';
import getTargetPeriods from '@salesforce/apex/TargetController.getTargetPeriods';
import getSalesReps from '@salesforce/apex/TargetController.getSalesReps';
import getTargetVsActual from '@salesforce/apex/TargetController.getTargetVsActual';

export default class TargetManagement extends LightningElement {
    @track showCreateTarget = false;
    @track showTargetVsActual = false;
    @track targetPeriods = [];
    @track salesReps = [];
    @track productComparisons = [];
    @track selectedPeriod = '';
    @track selectedSalesRep = '';
    @track totalTargetQty = 0;
    @track totalTargetAmount = 0;
    @track totalSalesQty = 0;
    @track totalSalesAmount = 0;
    @track overallAchievement = '0.0';

    connectedCallback() {
        this.loadTargetPeriods();
        this.loadSalesReps();
    }

    get createTargetClass() {
        return `btn ${this.showCreateTarget ? 'btn-active' : ''}`;
    }

    get targetVsActualClass() {
        return `btn ${this.showTargetVsActual ? 'btn-active' : ''}`;
    }

    get hasData() {
        return this.productComparisons.length > 0;
    }

    get totalTarget() {
        return this.totalTargetAmount.toFixed(2);
    }

    get totalActual() {
        return this.totalSalesAmount.toFixed(2);
    }

    get achievementPercentage() {
        return this.overallAchievement;
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
        } catch (error) {
            this.showToast('Error', 'Error loading sales reps', 'error');
        }
    }

    handleCreateTarget() {
        this.showCreateTarget = true;
        this.showTargetVsActual = false;
    }

    handleTargetVsActual() {
        this.showCreateTarget = false;
        this.showTargetVsActual = true;
    }

    handleClose() {
        this.showCreateTarget = false;
        this.showTargetVsActual = false;
    }

    async handlePeriodChange(event) {
        this.selectedPeriod = event.target.value;
        await this.loadComparisons();
    }

    async handleSalesRepChange(event) {
        this.selectedSalesRep = event.target.value;
        await this.loadComparisons();
    }

    async loadComparisons() {
        if (this.selectedPeriod && this.selectedSalesRep) {
            try {
                const result = await getTargetVsActual({
                    period: this.selectedPeriod,
                    salesRepId: this.selectedSalesRep
                });
                
                this.productComparisons = result.lineItems;
                this.totalTargetQty = result.totalTargetQuantity;
                this.totalTargetAmount = result.totalTargetAmount;
                this.totalSalesQty = result.totalSalesQuantity;
                this.totalSalesAmount = result.totalSalesAmount;
                
                // Calculate overall achievement percentage
                this.overallAchievement = this.totalTargetAmount > 0 
                    ? ((this.totalSalesAmount / this.totalTargetAmount) * 100).toFixed(1)
                    : '0.0';
                    
            } catch (error) {
                this.showToast('Error', 'Error loading comparisons', 'error');
            }
        }
    }

    showToast(title, message, variant) {
        const event = new ShowToastEvent({
            title,
            message,
            variant
        });
        this.dispatchEvent(event);
    }
}