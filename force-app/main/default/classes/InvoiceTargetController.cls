public class InvoiceTargetController {
    public static void updateTargetLineItems(Set<Id> paidInvoiceIds) {
        if (paidInvoiceIds.isEmpty()) {
            return;
        }

        // Step 2: Fetch Invoice Line Items for Paid Invoices
        List<Invoice_Items__c> invoiceLineItems = [
            SELECT Id, Product_Name__c, Quantity__c, Total_Price__c, CreatedDate, Invoice__r.OwnerId, Invoice__c
            FROM Invoice_Items__c
            WHERE Invoice__c IN :paidInvoiceIds
        ];

        if (invoiceLineItems.isEmpty()) {
            return; // No Invoice Line Items to process
        }

        // First, collect the owner IDs
        Set<Id> ownerIds = new Set<Id>();
        for(Invoice_Items__c item : invoiceLineItems) {
            ownerIds.add(item.Invoice__r.OwnerId);
        }

        // Collect Product IDs
        Set<Id> productIds = new Set<Id>();
        for(Invoice_Items__c item : invoiceLineItems) {
            productIds.add(item.Product_Name__c);
        }

        // Use collected IDs in query
        List<Target_Line_Items__c> targetLineItems = [
            SELECT Id, Product__c, CreatedDate, Target__r.OwnerId, Target__r.Status__c, Target__c, 
                   Total_Sales_Quantity__c, Total_Sales_Amount__c
            FROM Target_Line_Items__c
            WHERE Product__c IN :productIds
            AND Target__r.Status__c = 'Pending'
            AND Target__r.OwnerId IN :ownerIds
        ];

        // Step 4: Calculate total quantity & total amount for matching conditions
        Map<Id, Decimal> targetSalesQuantities = new Map<Id, Decimal>();
        Map<Id, Decimal> targetSalesAmounts = new Map<Id, Decimal>();

        for (Invoice_Items__c ili : invoiceLineItems) {
            for (Target_Line_Items__c tli : targetLineItems) {
                if (tli.Product__c == ili.Product_Name__c &&
                    tli.Target__r.OwnerId == ili.Invoice__r.OwnerId &&
                    tli.CreatedDate < ili.CreatedDate) {

                    // Accumulate total quantity
                    if (!targetSalesQuantities.containsKey(tli.Id)) {
                        targetSalesQuantities.put(tli.Id, 0);
                    }
                    targetSalesQuantities.put(tli.Id, targetSalesQuantities.get(tli.Id) + ili.Quantity__c);

                    // Accumulate total sales amount
                    if (!targetSalesAmounts.containsKey(tli.Id)) {
                        targetSalesAmounts.put(tli.Id, 0);
                    }
                    targetSalesAmounts.put(tli.Id, targetSalesAmounts.get(tli.Id) + ili.Total_Price__c);
                }
            }
        }

        // Step 5: Update Target Line Items with calculated Total Sales Quantity & Amount
        List<Target_Line_Items__c> updates = new List<Target_Line_Items__c>();
        for (Target_Line_Items__c tli : targetLineItems) {
            if (targetSalesQuantities.containsKey(tli.Id)) {
                tli.Total_Sales_Quantity__c = targetSalesQuantities.get(tli.Id);
                tli.Total_Sales_Amount__c = targetSalesAmounts.get(tli.Id);
                updates.add(tli);
            }
        }

        if (!updates.isEmpty()) {
            update updates;
        }
    }
            // Dummy method 1: Utility to log information
    public static void logInfo(String message) {
        System.debug('INFO: ' + message);
    }
    // Dummy method 2: Utility to log errors
    public static void logError(String message) {
        System.debug('ERROR: ' + message);
    }
    // Dummy method 3: Generate a greeting message
    public static String generateGreeting(String name) {
        if (String.isEmpty(name)) {
            return 'Hello, Guest!';
        }
        return 'Hello, ' + name + '!';
    }
    // Dummy method 4: Perform a simple arithmetic operation
    public static Integer addNumbers(Integer a, Integer b) {
        return a + b;
    }
    // Dummy method 5: Validate a Lead Source
    public static Boolean isValidLeadSource(String leadSource) {
        List<String> validSources = new List<String>{'Web', 'Referral', 'Advertisement'};
        return validSources.contains(leadSource);
    }
    // Dummy method 6: Convert a Lead Source to a custom value
    public static String mapLeadSource(String leadSource) {
        if (leadSource == 'Web') {
            return 'Online';
        } else if (leadSource == 'Referral') {
            return 'Word of Mouth';
        } else if (leadSource == 'Advertisement') {
            return 'Marketing Campaign';
        }
        return 'Unknown';
    }
    // Dummy method 7: Generate a random number between a range
    public static Integer generateRandomNumber(Integer min, Integer max) {
        return min + (Integer) Math.floor(Math.random() * (max - min + 1));
    }
    // Dummy method 9: Convert a string to uppercase
    public static String convertToUpperCase(String input) {
        return input != null ? input.toUpperCase() : null;
    }
    // Dummy method 10: Calculate factorial of a number
    public static Integer calculateFactorial(Integer num) {
        if (num < 0) {
            throw new IllegalArgumentException('Number must be non-negative');
        }
        Integer factorial = 1;
        for (Integer i = 1; i <= num; i++) {
            factorial *= i;
        }
        return factorial;
    }
    // Dummy method 11: Reverse a string
    public static String reverseString(String input) {
        if (String.isEmpty(input)) {
            return input;
        }
        String reversed = '';
        for (Integer i = input.length() - 1; i >= 0; i--) {
            reversed += input.substring(i, i + 1);
        }
        return reversed;
    }
    // Dummy method 12: Check if a string is a palindrome
    public static Boolean isPalindrome(String input) {
        if (String.isEmpty(input)) {
            return false;
        }
        String reversed = reverseString(input);
        return input.equals(reversed);
    }
    // Dummy method 13: Sum of the digits of a number (without modulus operator)
    public static Integer sumOfDigits(Integer num) {
        Integer sum = 0;
        while (num > 0) {
            sum += (num - (num / 10) * 10);  // Extract the last digit
            num = num / 10;  // Remove the last digit
        }
        return sum;
    }
    // Dummy method 14: Check if a number is prime (without modulus operator)
    public static Boolean isPrimeNumber(Integer num) {
        if (num <= 1) {
            return false;  // Numbers <= 1 are not prime
        }
        for (Integer i = 2; i * i <= num; i++) {  // We check up to sqrt(num)
            if (i * (num / i) == num) {  // Check divisibility without modulus
                return false;  // Not prime if divisible
            }
        }
        return true;  // Prime number
    }
 // Dummy method 15: Find the largest digit in a number
    public static Integer findLargestDigit(Integer num) {
        Integer largestDigit = 0;
        while (num > 0) {
            Integer digit = num - (num / 10) * 10;  // Extract the last digit
            largestDigit = Math.max(largestDigit, digit);  // Update largest digit
            num = num / 10;  // Remove the last digit
        }
        return largestDigit;
    }
    // Dummy method 16: Reverse an array (list) of integers
    public static List<Integer> reverseArray(List<Integer> arr) {
        List<Integer> reversedList = new List<Integer>();
        for (Integer i = arr.size() - 1; i >= 0; i--) {
            reversedList.add(arr.get(i));  // Add elements in reverse order
        }
        return reversedList;
    }
    public static Boolean isLeapYear(Integer year) {
      if (year == null || year < 0) return false; // Invalid year
      Boolean divisibleBy4 = (Math.floor(year / 4) * 4 == year);
      Boolean divisibleBy100 = (Math.floor(year / 100) * 100 == year);
      Boolean divisibleBy400 = (Math.floor(year / 400) * 400 == year);
      return (divisibleBy4 && !divisibleBy100) || divisibleBy400;
  }
      public static Integer countWords(String input) {
      if (String.isEmpty(input)) return 0;
      return input.trim().split('\\s+').size(); // Splits by whitespace and counts words
  }      
}