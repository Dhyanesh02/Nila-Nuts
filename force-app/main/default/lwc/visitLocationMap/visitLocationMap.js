import { LightningElement, wire, api } from 'lwc';
import getVisitLocations from '@salesforce/apex/VisitLocationController.getVisitLocations';

export default class VisitLocationMap extends LightningElement {
    @api recordId; // Visit Id if viewing a single visit
    @api showAllVisits = false; // Toggle to show all visits or single visit
    
    mapMarkers = [];
    zoomLevel = 13;
    error;
    listView = 'hidden'; // This will hide the markers list

    // Updated Google Maps-style pin path for a more accurate look
    pinPath = 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z';

    @wire(getVisitLocations, { 
        visitId: '$recordId',
        showAllVisits: '$showAllVisits'
    })
    wiredLocations({ error, data }) {
        if (data) {
            console.log('Visit data:', data);
            this.mapMarkers = this.createMapMarkers(data);
            this.error = undefined;
        } else if (error) {
            this.error = error;
            this.mapMarkers = [];
        }
    }

    createMapMarkers(visits) {
        let markers = [];
        
        visits.forEach(visit => {
            console.log('Visit check-in coordinates:', {
                lat: visit.Checkin_Latitude__c,
                lng: visit.Checkin_Longitude__c
            });
            console.log('Visit check-out coordinates:', {
                lat: visit.Checkout_Latitude__c,
                lng: visit.Checkout_Longitude__c
            });
            // Add Check-in marker if coordinates exist
            if (visit.Checkin_Latitude__c && visit.Checkin_Longitude__c) {
                markers.push({
                    location: {
                        Latitude: visit.Checkin_Latitude__c,
                        Longitude: visit.Checkin_Longitude__c
                    },
                    title: visit.Customer__r.Name,
                    description: this.formatDateTime(visit.Actual_start_Time__c),
                    icon: 'standard:visit',
                    mapIcon: {
                        path: this.pinPath,
                        fillColor: '#4285F4', // Google Maps blue for check-in
                        fillOpacity: 1,
                        strokeWeight: 1,
                        strokeColor: '#FFFFFF',
                        scale: 1.8,
                        anchor: { x: 12, y: 22 },
                        labelOrigin: { x: 12, y: 9 }
                    }
                });
            }

            // Add Check-out marker if coordinates exist
            if (visit.Checkout_Latitude__c && visit.Checkout_Longitude__c) {
                markers.push({
                    location: {
                        Latitude: visit.Checkout_Latitude__c,
                        Longitude: visit.Checkout_Longitude__c
                    },
                    title: visit.Customer__r.Name,
                    description: this.formatDateTime(visit.Actual_End_Time__c),
                    icon: 'standard:visit',
                    mapIcon: {
                        path: this.pinPath,
                        fillColor: '#EA4335', // Google Maps red for check-out
                        fillOpacity: 1,
                        strokeWeight: 1,
                        strokeColor: '#FFFFFF',
                        scale: 1.8,
                        anchor: { x: 12, y: 22 },
                        labelOrigin: { x: 12, y: 9 }
                    }
                });
            }
        });

        return markers;
    }

    formatDateTime(dateTimeStr) {
        if (!dateTimeStr) return '';
        return new Date(dateTimeStr).toLocaleString();
    }
}